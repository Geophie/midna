import { loadPyodide } from "pyodide";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..");
const core = path.join(root, "public", "py", "core");
const pipeline = path.join(root, "public", "py", "webcore", "pipeline.py");
const coreFiles = [
  "aoi.py", "buffer_zone.py", "grid.py", "outliers.py", "rossmo_numpy.py",
  "rossmo_loop.py", "weights.py", "normalize.py", "ranking.py", "evaluation.py", "stats.py",
];

const B_ZERO_MESSAGE =
  "Automatic B cannot be computed because all nearest-neighbour distances are zero. " +
  "Check for duplicate or coincident crime locations, or specify B manually.";

async function main() {
  const pyodide = await loadPyodide();
  await pyodide.loadPackage(["numpy", "pandas", "geopandas", "shapely", "fiona"]);
  pyodide.FS.mkdirTree("/core");
  pyodide.FS.mkdirTree("/webcore");
  for (const file of coreFiles) {
    pyodide.FS.writeFile(`/core/${file}`, fs.readFileSync(path.join(core, file), "utf8"));
  }
  pyodide.FS.writeFile("/webcore/pipeline.py", fs.readFileSync(pipeline, "utf8"));
  pyodide.FS.writeFile("/AAAA.csv", "Latitude,Longitude\n33,-84\n33,-84\n33,-84\n33,-84\n");
  pyodide.FS.writeFile("/AACC.csv", "Latitude,Longitude\n33,-84\n33,-84\n33.01,-84.01\n33.01,-84.01\n");

  const output = await pyodide.runPythonAsync(`
import json, sys
import numpy as np
import geopandas as gpd
from shapely.geometry import Point, box
for p in ("/", "/webcore"):
    if p not in sys.path:
        sys.path.insert(0, p)
from core.buffer_zone import computeBufferZone
from core.evaluation import computeHitScore, computeSearchArea
from core.ranking import rankCells
import pipeline

out = {}

rank_grid = gpd.GeoDataFrame(
    {"cell_id": [0, 1, 2, 3, 4], "score": [100.0, 100.0, 90.0, 80.0, 80.0]},
    geometry=[box(i * 100, 0, (i + 1) * 100, 100) for i in range(5)],
    crs="EPSG:3857",
)
ranked = rankCells(rank_grid)
top_hit = computeHitScore(ranked, Point(50, 50))
top_area = computeSearchArea(ranked, top_hit["anchor_score"])
out["ranks_by_cell"] = ranked.sort_values("cell_id")["rank"].tolist()
out["rank_dtypes"] = [type(v).__name__ for v in ranked["rank"].tolist()]
out["top_hit"] = top_hit
out["top_area"] = top_area
out["finite_rank_input"] = bool(np.isfinite(ranked["score"].to_numpy(dtype=float)).all())

nonfinite = rankCells(gpd.GeoDataFrame(
    {"cell_id": [0, 1, 2], "score": [1.0, np.nan, 2.0]},
    geometry=[box(i, 0, i + 1, 1) for i in range(3)], crs="EPSG:3857",
))
out["nonfinite_ranks"] = nonfinite["rank"].tolist()

projected = gpd.GeoDataFrame(
    {"score": [1.0], "rank": [1]}, geometry=[box(0, 0, 100, 100)], crs="EPSG:3857"
)
out["projected_outside"] = computeHitScore(projected, Point(250, 50))
out["projected_inside"] = computeHitScore(projected, Point(1, 1))

geographic = gpd.GeoDataFrame(
    {"score": [1.0], "rank": [1]}, geometry=[box(12, 45, 12.01, 45.01)], crs="EPSG:4326"
)
geographic_anchor = Point(12.02, 45.005)
metric = geographic.to_crs(geographic.estimate_utm_crs())
metric_anchor = gpd.GeoSeries([geographic_anchor], crs=geographic.crs).to_crs(metric.crs).iloc[0]
out["geographic_reported"] = computeHitScore(geographic, geographic_anchor)["distance_to_nearest_cell_m"]
out["geographic_expected_m"] = float(metric.geometry.distance(metric_anchor).min())

cases = {
    "AAAA": np.array([[0, 0], [0, 0], [0, 0], [0, 0]], dtype=float),
    "AACC": np.array([[0, 0], [0, 0], [10, 0], [10, 0]], dtype=float),
    "AACD": np.array([[0, 0], [0, 0], [10, 0], [25, 0]], dtype=float),
    "ABCD": np.array([[0, 0], [3, 0], [10, 0], [25, 0]], dtype=float),
}
out["buffer"] = {}
for name, coords in cases.items():
    try:
        out["buffer"][name] = {"value": computeBufferZone(coords)}
    except ValueError as exc:
        out["buffer"][name] = {"error": str(exc)}

async def no_cancel(_frac, _stage):
    return False

base = {
    "lat_col": "Latitude", "lon_col": "Longitude", "input_crs": "EPSG:4326", "analysis_crs": "EPSG:4326",
    "cells_x": 2, "cells_y": 2, "aoi_padding_pct": 10,
    "f": 1.2, "g": 1.2, "k": 1.0, "b_auto": True, "b_value": 0,
    "engine": "numpy", "use_outliers": False, "outlier_threshold_multiplier": 2.0,
    "use_normalize": True, "use_gini": True, "layers": [],
}
for name in ("AAAA", "AACC"):
    path = f"/{name}.csv"
    try:
        await pipeline.run({**base, "crimes_csv_path": path}, no_cancel)
        out[f"pipeline_{name}"] = None
    except ValueError as exc:
        out[f"pipeline_{name}"] = str(exc)

json.dumps(out)
`);

  const result = JSON.parse(String(output));
  const fail = (message) => {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  };

  if (JSON.stringify(result.ranks_by_cell) !== JSON.stringify([1, 1, 3, 4, 4])) {
    fail(`competition ranks: ${JSON.stringify(result.ranks_by_cell)}`);
  }
  if (!result.rank_dtypes.every((type) => type === "int")) fail(`rank dtypes: ${result.rank_dtypes}`);
  if (!result.finite_rank_input) fail("ordinary finite score fixture did not enter ranking with finite scores");
  if (result.top_hit.anchor_rank !== 1 || result.top_hit.hit_score_pct !== 40 || result.top_area.n_priority_cells !== 2) {
    fail(`tied anchor metrics: ${JSON.stringify({ hit: result.top_hit, area: result.top_area })}`);
  }
  if (JSON.stringify(result.nonfinite_ranks) !== JSON.stringify([1, 2, 3])) {
    fail(`non-finite fallback ranks changed: ${JSON.stringify(result.nonfinite_ranks)}`);
  }
  if (result.projected_outside.distance_to_nearest_cell_m !== 150) {
    fail(`projected footprint distance: ${result.projected_outside.distance_to_nearest_cell_m}`);
  }
  if (result.projected_inside.distance_to_nearest_cell_m !== 0) {
    fail(`contained non-centroid distance: ${result.projected_inside.distance_to_nearest_cell_m}`);
  }
  if (Math.abs(result.geographic_reported - result.geographic_expected_m) > 1e-8 || result.geographic_reported < 100) {
    fail(`geographic metric distance: ${JSON.stringify(result)}`);
  }
  for (const name of ["AAAA", "AACC"]) {
    if (result.buffer[name].error !== B_ZERO_MESSAGE) fail(`${name} B diagnostic: ${JSON.stringify(result.buffer[name])}`);
  }
  if (result.buffer.AACD.value !== 3.125 || result.buffer.ABCD.value !== 3.5) {
    fail(`positive B cases: ${JSON.stringify(result.buffer)}`);
  }
  if (result.pipeline_AAAA !== "error_crimes_identical") fail(`pipeline identical guard: ${result.pipeline_AAAA}`);
  if (result.pipeline_AACC !== B_ZERO_MESSAGE) fail(`pipeline duplicate-cluster diagnostic: ${result.pipeline_AACC}`);

  if (process.exitCode) process.exit(process.exitCode);
  console.log("MINOR FINDINGS REGRESSION TEST PASSED");
}

main().catch((error) => {
  console.error("test crashed:", error);
  process.exit(1);
});

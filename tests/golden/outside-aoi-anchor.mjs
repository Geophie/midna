// Finding 1 — core and pipeline semantics for an anchor outside the AOI.
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

async function main() {
  const pyodide = await loadPyodide();
  await pyodide.loadPackage(["numpy", "pandas", "geopandas", "shapely", "fiona"]);
  pyodide.FS.mkdirTree("/core");
  pyodide.FS.mkdirTree("/webcore");
  for (const file of coreFiles) {
    pyodide.FS.writeFile(`/core/${file}`, fs.readFileSync(path.join(core, file), "utf8"));
  }
  pyodide.FS.writeFile("/webcore/pipeline.py", fs.readFileSync(pipeline, "utf8"));
  pyodide.FS.writeFile("/crimes.csv", `Latitude,Longitude\n33.7490,-84.3880\n33.7590,-84.3780\n33.7390,-84.3980\n33.7690,-84.3680\n`);

  const output = await pyodide.runPythonAsync(`
import json, sys
import geopandas as gpd
from shapely.geometry import Point, box
for p in ("/", "/webcore"):
    if p not in sys.path:
        sys.path.insert(0, p)
from core.evaluation import computeHitScore, computeSearchArea
import pipeline

grid = gpd.GeoDataFrame(
    {"score": [1.0, 3.0], "rank": [2, 1]},
    geometry=[box(0, 0, 100, 100), box(100, 0, 200, 100)],
    crs="EPSG:3857",
)
primitive_inside = computeHitScore(grid, Point(50, 50))
primitive_outside = computeHitScore(grid, Point(350, 50))
search_inside = computeSearchArea(grid, primitive_inside["anchor_score"])

async def no_cancel(_frac, _stage):
    return False

params = {
    "crimes_csv_path": "/crimes.csv", "lat_col": "Latitude", "lon_col": "Longitude",
    "input_crs": "EPSG:4326", "analysis_crs": "EPSG:4326",
    "cells_x": 10, "cells_y": 10, "aoi_padding_pct": 10,
    "f": 1.2, "g": 1.2, "k": 1.0, "b_auto": True, "b_value": 0,
    "engine": "numpy", "use_outliers": False, "outlier_threshold_multiplier": 2.0,
    "use_normalize": True, "use_gini": True, "layers": [],
}
inside = await pipeline.run({**params, "anchor_lat": 33.7490, "anchor_lon": -84.3880}, no_cancel)
outside = await pipeline.run({**params, "anchor_lat": 40.0, "anchor_lon": -100.0}, no_cancel)
json.dumps({
    "primitive_inside": primitive_inside,
    "primitive_outside": primitive_outside,
    "search_inside": search_inside,
    "pipeline_inside": inside["baseline_eval"],
    "pipeline_outside": outside["baseline_eval"],
})
`);

  const result = JSON.parse(String(output));
  let ok = true;
  const fail = (message) => { console.error(`FAIL: ${message}`); ok = false; };

  const direct = result.primitive_outside;
  if (direct.is_contained !== false) fail("outside primitive anchor must not be contained");
  for (const key of ["anchor_cell_idx", "anchor_score", "anchor_rank", "hit_score_pct", "home_guess_distance_m"]) {
    if (direct[key] !== null) fail(`outside primitive ${key} must be null, got ${direct[key]}`);
  }
  if (!(typeof direct.distance_to_nearest_cell_m === "number" && direct.distance_to_nearest_cell_m > 0)) {
    fail(`outside primitive diagnostic distance must be positive, got ${direct.distance_to_nearest_cell_m}`);
  }

  const valid = result.primitive_inside;
  if (!(valid.is_contained && valid.anchor_score === 1 && valid.anchor_rank === 2 && valid.hit_score_pct === 100 && valid.home_guess_distance_m === 100)) {
    fail(`inside primitive metrics changed: ${JSON.stringify(valid)}`);
  }
  if (result.search_inside.search_area_km2 !== 0.02 || result.search_inside.n_priority_cells !== 2) {
    fail(`inside primitive search-area inputs changed: ${JSON.stringify(result.search_inside)}`);
  }

  const pipelineOutside = result.pipeline_outside;
  if (pipelineOutside.status !== "out_of_domain") fail(`pipeline status must be out_of_domain, got ${pipelineOutside.status}`);
  for (const key of ["anchor_score", "anchor_rank", "hit_score_pct", "search_area_km2", "home_guess_distance_m"]) {
    if (pipelineOutside[key] !== null) fail(`outside pipeline ${key} must be null, got ${pipelineOutside[key]}`);
  }
  if (!(typeof pipelineOutside.distance_to_nearest_cell_m === "number" && pipelineOutside.distance_to_nearest_cell_m > 0)) {
    fail(`outside pipeline diagnostic distance must be positive, got ${pipelineOutside.distance_to_nearest_cell_m}`);
  }
  const pipelineInside = result.pipeline_inside;
  if (pipelineInside.status !== "valid" || pipelineInside.search_area_km2 === null || pipelineInside.home_guess_distance_m === null) {
    fail(`inside pipeline metrics must remain available: ${JSON.stringify(pipelineInside)}`);
  }

  if (!ok) process.exit(1);
  console.log("OUTSIDE-AOI ANCHOR TEST PASSED");
}

main().catch((error) => { console.error("test crashed:", error); process.exit(1); });

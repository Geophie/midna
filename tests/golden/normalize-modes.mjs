import { loadPyodide } from "pyodide";
import fs from "node:fs";
import path from "node:path";

// Focused regression test for score normalization:
//   normalized = score / max(score) * 100   (max-only, no minimum subtracted)
// Half 1 exercises core/normalize.normalizeScores directly.
// Half 2 runs the full pipeline with Normalize ON and OFF and checks that the
// method scales baseline AND enhanced surfaces while leaving raw scores/ranks
// alone, and that Normalize OFF leaves scores untouched.

const root = path.resolve(import.meta.dirname, "..", "..");
const CORE_SRC = path.join(root, "public", "py", "core");
const PIPELINE_SRC = path.join(root, "public", "py", "webcore", "pipeline.py");
const CORE_FILES = [
  "aoi.py",
  "buffer_zone.py",
  "grid.py",
  "outliers.py",
  "rossmo_numpy.py",
  "rossmo_loop.py",
  "weights.py",
  "normalize.py",
  "ranking.py",
  "evaluation.py",
  "stats.py",
];

const CRIMES_CSV = `Latitude,Longitude
33.7490,-84.3880
33.7590,-84.3780
33.7390,-84.3980
33.7690,-84.3680
33.7290,-84.4080
33.7550,-84.3750
`;

async function main() {
  if (!fs.existsSync(path.join(CORE_SRC, "normalize.py"))) {
    console.error("public/py/core not found — run `npm run prepare:assets` first.");
    process.exit(1);
  }

  const pyodide = await loadPyodide();
  await pyodide.loadPackage(["numpy", "pandas", "geopandas", "shapely", "fiona"]);

  pyodide.FS.mkdirTree("/core");
  pyodide.FS.mkdirTree("/webcore");
  for (const file of CORE_FILES) {
    pyodide.FS.writeFile(`/core/${file}`, fs.readFileSync(path.join(CORE_SRC, file), "utf-8"));
  }
  pyodide.FS.writeFile("/webcore/pipeline.py", fs.readFileSync(PIPELINE_SRC, "utf-8"));
  pyodide.FS.writeFile("/crimes.csv", CRIMES_CSV);

  const resultJson = await pyodide.runPythonAsync(`
import sys, json
for p in ("/", "/webcore"):
    if p not in sys.path:
        sys.path.insert(0, p)

import numpy as np
import pandas as pd
import geopandas as gpd
from shapely.geometry import box

import core.aoi as aoi
import core.normalize as normalize
import pipeline

out = {}

# ---- Half 1: normalizeScores directly -------------------------------------
def norm(vals):
    df = pd.DataFrame({"score": list(vals)})
    return normalize.normalizeScores(df, col="score")["score"].tolist()

out["basic"] = norm([10, 20, 30])                 # -> [33.33.., 66.66.., 100]
out["ranks"] = norm([5, 1, 9, 3])                 # order preserved, all > 0
out["allzero"] = norm([0, 0, 0])                  # -> [0, 0, 0]
out["constant"] = norm([5, 5, 5])                 # -> [100, 100, 100]
out["nonfinite"] = norm([float("nan"), 10, 20])  # nan->0, -> [0, 50, 100]

# ---- Half 2: full pipeline, Normalize ON vs OFF --------------------------
crimes_gdf = aoi.loadCrimesCsv("/crimes.csv", latCol="Latitude", lonCol="Longitude")
crimes_gdf = gpd.GeoDataFrame(
    crimes_gdf,
    geometry=gpd.points_from_xy(crimes_gdf["Longitude"], crimes_gdf["Latitude"]),
    crs="EPSG:4326",
)
aoi_gdf = aoi.computeAoiFromGdf(crimes_gdf)
minx, miny, maxx, maxy = aoi_gdf.total_bounds
# One inclusion layer, both weights > 0 -> enhanced surface, no zero weights.
incl_gdf = gpd.GeoDataFrame(
    {"name": ["zone"]},
    geometry=[box(minx, miny, (minx + maxx) / 2, maxy)],
    crs="EPSG:4326",
)
incl_gdf.to_file("/incl.geojson", driver="GeoJSON")

async def no_cancel(frac, stage):
    return False

base_params = {
    "crimes_csv_path": "/crimes.csv",
    "lat_col": "Latitude",
    "lon_col": "Longitude",
    "input_crs": "EPSG:4326",
    "analysis_crs": "EPSG:4326",
    "cells_x": 12,
    "cells_y": 12,
    "f": 1.2,
    "g": 1.2,
    "k": 1.0,
    "b_auto": True,
    "b_value": 0,
    "engine": "numpy",
    "use_outliers": False,
    "outlier_threshold_multiplier": 2.0,
    "layers": [
        {
            "type": "inclusion", "name": "incl", "path": "/incl.geojson",
            "intersectWeight": 1.0, "noIntersectWeight": 0.5,
        },
    ],
}

runs = {}
for tag, use_norm in (("on", True), ("off", False)):
    params = dict(base_params, use_normalize=use_norm)
    outcome = await pipeline.run(params, no_cancel)
    baseline = gpd.GeoDataFrame.from_features(json.loads(outcome["baseline_geojson"])["features"])
    scored = gpd.GeoDataFrame.from_features(json.loads(outcome["enhanced_geojson"])["features"])
    runs[tag] = {
        "baseline_raw": baseline.sort_values("cell_id")["score_raw"].tolist(),
        "baseline_norm": baseline.sort_values("cell_id")["score"].tolist(),
        "baseline_rank": baseline.sort_values("cell_id")["rank"].tolist(),
        "enh_raw": scored.sort_values("cell_id")["score_enhanced_raw"].tolist(),
        "enh_norm": scored.sort_values("cell_id")["score_enhanced"].tolist(),
        "enh_rank": scored.sort_values("cell_id")["rank"].tolist(),
    }

out["runs"] = runs
json.dumps(out)
`);

  const r = JSON.parse(resultJson);
  let ok = true;
  const fail = (msg) => {
    console.error(`FAIL: ${msg}`);
    ok = false;
  };
  const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
  const arrClose = (a, b, eps = 1e-9) =>
    a.length === b.length && a.every((v, i) => close(v, b[i], eps));
  const isSorted = (a) => a.every((v, i) => i === 0 || v >= a[i - 1] - 1e-9);
  const maxOf = (a) => Math.max(...a);

  // max-only formula
  if (!arrClose(r.basic, [100 / 3, 200 / 3, 100])) fail(`[10,20,30] => ${r.basic}`);
  // raw minimum > 0 stays > 0 (minimum is NOT subtracted)
  if (!(Math.min(...r.basic) > 0)) fail("max-only forced a positive minimum to 0");
  // ranking preserved (positive scaling)
  if (!arrClose(r.ranks, [500 / 9, 100 / 9, 100, 300 / 9])) fail(`[5,1,9,3] => ${r.ranks}`);
  // degenerate surfaces
  if (!arrClose(r.allzero, [0, 0, 0])) fail(`all-zero => ${r.allzero}`);
  if (!arrClose(r.constant, [100, 100, 100])) fail(`constant => ${r.constant}`);
  // non-finite handled the MIDNA way (zero-fill, then normalize)
  if (!arrClose(r.nonfinite, [0, 50, 100])) fail(`non-finite => ${r.nonfinite}`);

  const { on, off } = r.runs;
  // Normalize OFF: normalized columns equal raw, baseline and enhanced.
  if (!arrClose(off.baseline_norm, off.baseline_raw)) fail("Normalize OFF changed baseline scores");
  if (!arrClose(off.enh_norm, off.enh_raw)) fail("Normalize OFF changed enhanced scores");
  // raw scores + ranks identical whether or not normalization runs.
  if (!arrClose(on.baseline_raw, off.baseline_raw)) fail("baseline raw scores changed by normalize");
  if (!arrClose(on.enh_raw, off.enh_raw)) fail("enhanced raw scores changed by normalize");
  if (JSON.stringify(on.baseline_rank) !== JSON.stringify(off.baseline_rank))
    fail("baseline ranks changed by normalize");
  if (JSON.stringify(on.enh_rank) !== JSON.stringify(off.enh_rank))
    fail("enhanced ranks changed by normalize");
  // method applied to BOTH baseline and enhanced surfaces: score/max*100
  const rawMinB = Math.min(...on.baseline_raw);
  const rawMinE = Math.min(...on.enh_raw);
  if (!(rawMinB > 0 && rawMinE > 0)) fail("fixture no longer has strictly positive raw scores");
  if (!(Math.min(...on.baseline_norm) > 0)) fail("normalized baseline min should stay > 0");
  if (!(Math.min(...on.enh_norm) > 0)) fail("normalized enhanced min should stay > 0");
  if (!close(maxOf(on.baseline_norm), 100))
    fail(`normalized baseline max should be 100, got ${maxOf(on.baseline_norm)}`);
  if (!close(maxOf(on.enh_norm), 100))
    fail(`normalized enhanced max should be 100, got ${maxOf(on.enh_norm)}`);
  const expB = on.baseline_raw.map((v) => (v / maxOf(on.baseline_raw)) * 100);
  if (!arrClose(on.baseline_norm, expB, 1e-6)) fail("normalized baseline != score/max*100");
  const expE = on.enh_raw.map((v) => (v / maxOf(on.enh_raw)) * 100);
  if (!arrClose(on.enh_norm, expE, 1e-6)) fail("normalized enhanced != score/max*100");
  // normalized order still follows raw order
  const bySortedRaw = on.baseline_raw
    .map((raw, i) => ({ raw, n: on.baseline_norm[i] }))
    .sort((a, b) => a.raw - b.raw)
    .map((o) => o.n);
  if (!isSorted(bySortedRaw)) fail("normalization broke monotonic raw->normalized order");

  if (!ok) {
    console.error("\nNORMALIZE TEST FAILED");
    process.exit(1);
  }
  console.log("NORMALIZE TEST PASSED");
}

main().catch((err) => {
  console.error("normalize test crashed:", err);
  process.exit(1);
});

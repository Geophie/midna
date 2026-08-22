import { loadPyodide } from "pyodide";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..");
const CORE_SRC = path.join(root, "public", "py", "core");
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

// Golden values captured from a trusted run of this exact fixture/params.
// Regenerate deliberately (never to "make it pass") if core/ math changes.
const GOLDEN_SCORE_SUM = 169633.09654901753;
const GOLDEN_TOP_CELL_ID = 232;
const GOLDEN_B = 0.01;

async function main() {
  if (!fs.existsSync(path.join(CORE_SRC, "aoi.py"))) {
    console.error("public/py/core not found — run `npm run prepare:assets` first.");
    process.exit(1);
  }

  const pyodide = await loadPyodide();
  await pyodide.loadPackage(["numpy", "pandas", "geopandas", "shapely"]);

  pyodide.FS.mkdirTree("/core");
  for (const file of CORE_FILES) {
    pyodide.FS.writeFile(`/core/${file}`, fs.readFileSync(path.join(CORE_SRC, file), "utf-8"));
  }

  console.log("=== Running core/ __main__ self-checks inside Pyodide ===");
  for (const file of ["rossmo_numpy.py", "weights.py", "evaluation.py"]) {
    const src = fs.readFileSync(path.join(CORE_SRC, file), "utf-8");
    await pyodide.runPythonAsync(`
import sys
if "/" not in sys.path:
    sys.path.insert(0, "/")
__name__ = "__main__"
exec(compile(${JSON.stringify(src)}, ${JSON.stringify(file)}, "exec"))
`);
    console.log(`  ok: ${file}`);
  }

  console.log("\n=== numpy vs loop engine equivalence (real core/, same inputs) ===");
  const resultJson = await pyodide.runPythonAsync(`
import sys, json
if "/" not in sys.path:
    sys.path.insert(0, "/")

import numpy as np
import geopandas as gpd
from shapely.geometry import Point

import core.aoi as aoi
import core.grid as grid
import core.rossmo_numpy as rossmo_numpy
import core.rossmo_loop as rossmo_loop

crimes_gdf = gpd.GeoDataFrame(
    {"id": range(5)},
    geometry=[
        Point(-84.3880, 33.7490),
        Point(-84.3780, 33.7590),
        Point(-84.3980, 33.7390),
        Point(-84.3680, 33.7690),
        Point(-84.4080, 33.7290),
    ],
    crs="EPSG:4326",
)
crimes_xy = np.array([(g.x, g.y) for g in crimes_gdf.geometry])

aoi_gdf = aoi.computeAoiFromGdf(crimes_gdf)
grid_gdf = grid.createGrid(aoi_gdf, 20, 20)

B = ${GOLDEN_B}
f, g, k = 1.2, 1.2, 1.0

numpy_scored = rossmo_numpy.rossmoNumpy(grid_gdf, crimes_xy, B, f, g, k)
loop_scored = rossmo_loop.rossmoLoop(grid_gdf, crimes_xy, B, f, g, k)

numpy_scores = numpy_scored["score"].to_numpy()
loop_scores = loop_scored["score"].to_numpy()

max_abs_diff = float(np.max(np.abs(numpy_scores - loop_scores)))
score_sum = float(numpy_scores.sum())
top_cell_id = int(numpy_scored.loc[numpy_scored["score"].idxmax(), "cell_id"])

json.dumps({
    "max_abs_diff": max_abs_diff,
    "score_sum": score_sum,
    "top_cell_id": top_cell_id,
    "n_cells": len(numpy_scored),
})
`);

  const result = JSON.parse(resultJson);
  console.log(result);

  let ok = true;

  if (result.max_abs_diff > 1e-9) {
    console.error(`FAIL: numpy vs loop engines diverge, max_abs_diff=${result.max_abs_diff}`);
    ok = false;
  } else {
    console.log(`ok: numpy and loop engines agree (max_abs_diff=${result.max_abs_diff})`);
  }

  if (Math.abs(result.score_sum - GOLDEN_SCORE_SUM) > 1e-6) {
    console.error(
      `FAIL: score_sum regressed. golden=${GOLDEN_SCORE_SUM} got=${result.score_sum}`
    );
    ok = false;
  } else {
    console.log(`ok: score_sum matches golden (${result.score_sum})`);
  }

  if (result.top_cell_id !== GOLDEN_TOP_CELL_ID) {
    console.error(
      `FAIL: top cell_id regressed. golden=${GOLDEN_TOP_CELL_ID} got=${result.top_cell_id}`
    );
    ok = false;
  } else {
    console.log(`ok: top cell_id matches golden (${result.top_cell_id})`);
  }

  if (!ok) {
    console.error("\nGOLDEN TEST FAILED");
    process.exit(1);
  }
  console.log("\nGOLDEN TEST PASSED");
}

main().catch((err) => {
  console.error("golden test crashed:", err);
  process.exit(1);
});

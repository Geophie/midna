import { loadPyodide } from "pyodide";
import fs from "node:fs";
import path from "node:path";

const WEBAPP = path.resolve("C:/Users/giaco/Desktop/scriptgiacomo/WebApp");
const CORE_SRC = path.resolve("C:/Users/giaco/Desktop/scriptgiacomo/rossmo_toolkit/core");
const DATA = path.resolve("C:/Users/giaco/Desktop/scriptgiacomo/datsetgio");

const CORE_FILES = [
  "aoi.py", "buffer_zone.py", "grid.py", "outliers.py", "rossmo_numpy.py",
  "rossmo_loop.py", "weights.py", "normalize.py", "ranking.py", "evaluation.py", "stats.py",
];

const t0 = Date.now();
function log(msg) {
  console.log(`[+${((Date.now() - t0) / 1000).toFixed(1)}s] ${msg}`);
}

const pyodide = await loadPyodide();
log("pyodide loaded, loading packages...");
await pyodide.loadPackage(["numpy", "pandas", "geopandas", "shapely", "rasterio", "fiona"]);
log("packages loaded");

pyodide.FS.mkdirTree("/core");
pyodide.FS.mkdirTree("/webcore");
for (const f of CORE_FILES) {
  pyodide.FS.writeFile(`/core/${f}`, fs.readFileSync(path.join(CORE_SRC, f), "utf-8"));
}
pyodide.FS.writeFile(
  "/webcore/pipeline.py",
  fs.readFileSync(path.join(WEBAPP, "public/py/webcore/pipeline.py"), "utf-8")
);
await pyodide.runPythonAsync(`
import sys
for p in ("/", "/webcore"):
    if p not in sys.path:
        sys.path.insert(0, p)
import pipeline
`);
log("pipeline module imported");

function writeReal(fsPath, realPath) {
  pyodide.FS.writeFile(fsPath, fs.readFileSync(realPath));
}

writeReal("/input_crimes.csv", path.join(DATA, "Atlanta crime sites use case - Copia.csv"));
writeReal("/input_anchor.csv", path.join(DATA, "Williamshome.csv"));
writeReal("/input_grid.geojson", path.join(DATA, "reticoloNUOVO.geojson"));
writeReal("/input_layer_0.tif", path.join(DATA, "dem/output_NASADEM.tif"));

pyodide.FS.mkdirTree("/input_layer_1");
for (const ext of ["shp", "shx", "dbf", "prj", "cpg"]) {
  writeReal(`/input_layer_1/cemetery_polygon.${ext}`, path.join(DATA, `cimiteri/cemetery_polygon.${ext}`));
}
pyodide.FS.mkdirTree("/input_layer_2");
for (const ext of ["shp", "shx", "dbf", "prj", "cpg"]) {
  writeReal(`/input_layer_2/Parks.${ext}`, path.join(DATA, `Parks/Parks.${ext}`));
}
pyodide.FS.mkdirTree("/input_layer_3");
for (const ext of ["shp", "shx", "dbf", "prj", "cpg"]) {
  writeReal(`/input_layer_3/neighborhood.${ext}`, path.join(DATA, `neighborhood/neighborhood.${ext}`));
}
log("all fixture files written to pyodide FS");

const pyLayers = [
  {
    type: "dem", name: "DEM", path: "/input_layer_0.tif",
    pianuraMin: 0.0, collinaMin: 220.0, montagnaMin: 350.0,
    lowWeight: 0.4, midWeight: 0.8, highWeight: 0.0, nodataWeight: 0.0,
  },
  { type: "exclusion", name: "Cimiteri", path: "/input_layer_1/cemetery_polygon.shp", intersectWeight: 0.0, noIntersectWeight: 1.0 },
  { type: "exclusion", name: "Parks", path: "/input_layer_2/Parks.shp", intersectWeight: 0.0, noIntersectWeight: 1.0 },
  { type: "inclusion", name: "Neighborhood", path: "/input_layer_3/neighborhood.shp", intersectWeight: 1.0, noIntersectWeight: 0.0 },
];

const pyParams = pyodide.toPy({
  crimes_csv_path: "/input_crimes.csv",
  lat_col: "Latitude",
  lon_col: "Longitude",
  input_crs: "EPSG:4326",
  analysis_crs: "EPSG:4326",
  cells_x: 200,
  cells_y: 200,
  f: 4,
  g: 8,
  k: 1.0,
  b_auto: false,
  b_value: 0.0170,
  engine: "numpy",
  use_outliers: false,
  outlier_threshold_multiplier: 2.0,
  use_normalize: true,
  use_gini: true,
  anchor_path: "/input_anchor.csv",
  grid_path: "/input_grid.geojson",
  layers: pyLayers,
});

async function progressCb(frac, stage) {
  log(`[pipeline ${Math.round(frac * 100)}%] ${stage}`);
  return false;
}

const pipelineModule = pyodide.globals.get("pipeline");
const runFn = pipelineModule.run;

log("starting pipeline.run() ...");
const resultPy = await runFn(pyParams, progressCb);
const result = resultPy.toJs({ dict_converter: Object.fromEntries });
log("pipeline.run() done");

console.log("\n=== RESULT SUMMARY ===");
console.log("status:", result.status);
console.log("n_cells:", result.n_cells);
console.log("n_crimes:", result.n_crimes, "/", result.n_crimes_total);
console.log("b:", result.b);
console.log("baseline_gini:", result.baseline_gini);
console.log("enhanced_gini:", result.enhanced_gini);
console.log("baseline_eval:", result.baseline_eval);
console.log("enhanced_eval:", result.enhanced_eval);

const outDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
fs.writeFileSync(
  path.join(outDir, "repro-result.json"),
  JSON.stringify(result, (k, v) => (v instanceof Map ? Object.fromEntries(v) : v), 2)
);
log("wrote repro-result.json");

// Finding 4 — the advisory classifier uses pyproj metadata, not an EPSG list.
import { loadPyodide } from "pyodide";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..");
const source = path.join(root, "public", "py", "core", "crs.py");

async function main() {
  const pyodide = await loadPyodide();
  await pyodide.loadPackage(["geopandas"]);
  pyodide.FS.mkdirTree("/core");
  pyodide.FS.writeFile("/core/crs.py", fs.readFileSync(source, "utf8"));
  const output = await pyodide.runPythonAsync(`
import json, sys
if "/" not in sys.path:
    sys.path.insert(0, "/")
from core.crs import inspect_analysis_crs
json.dumps({value: inspect_analysis_crs(value) for value in [
    "EPSG:4326", "EPSG:4269", "EPSG:32616", "EPSG:3857", "not-a-crs"
]})
`);
  const result = JSON.parse(String(output));
  const expected = {
    "EPSG:4326": [true, true],
    "EPSG:4269": [true, true],
    "EPSG:32616": [true, false],
    "EPSG:3857": [true, false],
    "not-a-crs": [false, false],
  };
  for (const [crs, [valid, geographic]] of Object.entries(expected)) {
    const actual = result[crs];
    if (!actual || actual.valid !== valid || actual.is_geographic !== geographic) {
      console.error(`FAIL: ${crs}: expected valid=${valid}, geographic=${geographic}; got ${JSON.stringify(actual)}`);
      process.exit(1);
    }
  }
  console.log("ANALYSIS-CRS CLASSIFICATION TEST PASSED");
}

main().catch((error) => { console.error("test crashed:", error); process.exit(1); });

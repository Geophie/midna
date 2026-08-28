import { loadPyodide } from "pyodide";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..");
const core = path.join(root, "public", "py", "core");
const pipeline = path.join(root, "public", "py", "webcore", "pipeline.py");
const coreFiles = [
  "aoi.py", "buffer_zone.py", "grid.py", "outliers.py", "rossmo_numpy.py", "rossmo_loop.py",
  "weights.py", "normalize.py", "ranking.py", "evaluation.py", "stats.py",
];

async function main() {
  const pyodide = await loadPyodide();
  await pyodide.loadPackage(["numpy", "pandas", "geopandas", "shapely"]);
  pyodide.FS.mkdirTree("/core");
  pyodide.FS.mkdirTree("/webcore");
  for (const file of coreFiles) {
    pyodide.FS.writeFile(`/core/${file}`, fs.readFileSync(path.join(core, file), "utf8"));
  }
  pyodide.FS.writeFile("/webcore/pipeline.py", fs.readFileSync(pipeline, "utf8"));

  const result = JSON.parse(await pyodide.runPythonAsync(`
import json, sys
for directory in ("/", "/webcore"):
    if directory not in sys.path:
        sys.path.insert(0, directory)

import core.aoi as aoi
import pipeline

headers = {
    "exact": "CaseID,Latitude,Longitude\\n1,33.75,-84.39\\n2,33.76,-84.38\\n",
    "lowercase": "CaseID,latitude,longitude\\n1,33.75,-84.39\\n2,33.76,-84.38\\n",
    "uppercase": "CaseID,LATITUDE,LONGITUDE\\n1,33.75,-84.39\\n2,33.76,-84.38\\n",
    "mixed": "CaseID,latitude,LONGITUDE\\n1,33.75,-84.39\\n2,33.76,-84.38\\n",
}
out = {"resolved": {}, "original_headers": {}, "errors": {}}
for name, csv in headers.items():
    path = f"/{name}.csv"
    open(path, "w").write(csv)
    df = aoi.loadCrimesCsv(path, "Latitude", "Longitude")
    out["resolved"][name] = aoi.resolveCsvColumnNames(df.columns, "Latitude", "Longitude")
    out["original_headers"][name] = list(df.columns)

gdf = pipeline._load_geodata("/mixed.csv", "Latitude", "Longitude", "EPSG:4326", "EPSG:4326")
out["pipeline_points"] = [[float(p.x), float(p.y)] for p in gdf.geometry]

open("/missing.csv", "w").write("CaseID,Lat,Lon\\n1,33.75,-84.39\\n")
try:
    aoi.loadCrimesCsv("/missing.csv", "Latitude", "Longitude")
except ValueError as error:
    out["errors"]["missing"] = str(error)

open("/ambiguous.csv", "w").write("Latitude,latitude,Longitude\\n33.75,33.75,-84.39\\n")
try:
    aoi.loadCrimesCsv("/ambiguous.csv", "Latitude", "Longitude")
except ValueError as error:
    out["errors"]["ambiguous"] = str(error)

json.dumps(out)
`));

  let ok = true;
  const fail = (message) => {
    console.error(`FAIL: ${message}`);
    ok = false;
  };
  const expected = {
    exact: ["Latitude", "Longitude"],
    lowercase: ["latitude", "longitude"],
    uppercase: ["LATITUDE", "LONGITUDE"],
    mixed: ["latitude", "LONGITUDE"],
  };
  for (const [name, columns] of Object.entries(expected)) {
    if (JSON.stringify(result.resolved[name]) !== JSON.stringify(columns)) fail(`${name} resolved ${result.resolved[name]}`);
    if (!result.original_headers[name].includes(columns[0]) || !result.original_headers[name].includes(columns[1])) {
      fail(`${name} renamed CSV headers`);
    }
  }
  if (JSON.stringify(result.pipeline_points) !== JSON.stringify([[-84.39, 33.75], [-84.38, 33.76]])) {
    fail(`pipeline CSV points ${JSON.stringify(result.pipeline_points)}`);
  }
  if (result.errors.missing !== "Columns 'Latitude' and/or 'Longitude' not found in /missing.csv.") {
    fail(`missing-column error changed: ${result.errors.missing}`);
  }
  if (!/CSV coordinate column 'Latitude' is ambiguous: case-insensitive matches 'Latitude', 'latitude'\./.test(result.errors.ambiguous)) {
    fail(`ambiguous-column error unclear: ${result.errors.ambiguous}`);
  }
  if (!ok) process.exit(1);
  console.log("CSV header resolution verification passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

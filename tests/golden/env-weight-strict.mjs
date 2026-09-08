// Golden: the browser pipeline reads every environmental field with strict key
// access. A fully-populated valid LayerSpec produces the exact same weighted
// surface as before (weights.py math untouched); a LayerSpec missing a required
// field now fails loudly instead of silently substituting a pipeline default.

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
  await pyodide.loadPackage(["numpy", "pandas", "geopandas", "shapely", "rasterio", "fiona"]);
  pyodide.FS.mkdirTree("/core");
  pyodide.FS.mkdirTree("/webcore");
  for (const file of coreFiles) {
    pyodide.FS.writeFile(`/core/${file}`, fs.readFileSync(path.join(core, file), "utf8"));
  }
  pyodide.FS.writeFile("/webcore/pipeline.py", fs.readFileSync(pipeline, "utf8"));
  pyodide.FS.writeFile(
    "/crimes.csv",
    "Latitude,Longitude\n33.749,-84.388\n33.759,-84.378\n33.739,-84.398\n33.769,-84.368\n33.729,-84.408\n33.755,-84.375\n",
  );

  const result = JSON.parse(await pyodide.runPythonAsync(`
import json, sys, traceback
import numpy as np
import geopandas as gpd
import rasterio
from rasterio.transform import from_origin
from shapely.geometry import box

for p in ("/", "/webcore"):
    if p not in sys.path:
        sys.path.insert(0, p)

import core.aoi as aoi
import pipeline

crimes = aoi.loadCrimesCsv("/crimes.csv", latCol="Latitude", lonCol="Longitude")
crimes = gpd.GeoDataFrame(crimes, geometry=gpd.points_from_xy(crimes["Longitude"], crimes["Latitude"]), crs="EPSG:4326")
area = aoi.computeAoiFromGdf(crimes, bufferPct=0.1)
minx, miny, maxx, maxy = area.total_bounds
midx = (minx + maxx) / 2.0

w = h = 24
transform = from_origin(minx, maxy, (maxx - minx) / w, (maxy - miny) / h)
with rasterio.open("/dem.tif", "w", driver="GTiff", height=h, width=w, count=1,
                   dtype="float32", crs="EPSG:4326", transform=transform) as dst:
    dst.write(np.linspace(0, 500, w * h, dtype="float32").reshape(h, w), 1)

gpd.GeoDataFrame({"name": ["incl"]}, geometry=[box(minx, miny, midx, maxy)], crs="EPSG:4326").to_file("/incl.geojson", driver="GeoJSON")
gpd.GeoDataFrame({"name": ["excl"]}, geometry=[box(midx, miny, maxx, (miny + maxy) / 2)], crs="EPSG:4326").to_file("/excl.geojson", driver="GeoJSON")

async def no_cancel(frac, stage):
    return False

base = dict(
    crimes_csv_path="/crimes.csv", lat_col="Latitude", lon_col="Longitude",
    input_crs="EPSG:4326", analysis_crs="EPSG:4326",
    cells_x=10, cells_y=10, aoi_padding_pct=10.0, f=1.2, g=1.2, k=1.0,
    b_auto=True, b_value=0, engine="numpy",
    use_outliers=False, use_normalize=True, use_gini=True,
)

# A fully-populated valid LayerSpec (documented core-default DEM weights + the
# standard inclusion/exclusion vector defaults).
dem = dict(type="dem", name="dem", path="/dem.tif",
           pianuraMin=0.0, collinaMin=250.0, montagnaMin=350.0,
           lowWeight=0.4, midWeight=0.8, highWeight=0.0, nodataWeight=0.0)
incl = dict(type="inclusion", name="incl", path="/incl.geojson",
            intersectWeight=1.0, noIntersectWeight=0.0)
excl = dict(type="exclusion", name="excl", path="/excl.geojson",
            intersectWeight=0.0, noIntersectWeight=1.0)

out = await pipeline.run(dict(base, layers=[dem, incl, excl]), no_cancel)
g = gpd.GeoDataFrame.from_features(json.loads(out["enhanced_geojson"])["features"]).sort_values("cell_id").reset_index(drop=True)
wcols = [c for c in g.columns if c.startswith("w_")]

# H / numerical invariance: the weighted surface is exactly score_raw * product
# of the per-cell weight columns, and the weight columns only ever hold the
# configured values.
prod = g[wcols].prod(axis=1).to_numpy()
raw_ok = bool(np.allclose(g["score_enhanced_raw"].to_numpy(), g["score_raw"].to_numpy() * prod, rtol=0, atol=1e-9))
dem_vals = sorted(set(np.round(g[wcols[0]].to_numpy(), 6).tolist()))
incl_vals = sorted(set(np.round(g[wcols[1]].to_numpy(), 6).tolist()))
excl_vals = sorted(set(np.round(g[wcols[2]].to_numpy(), 6).tolist()))

# G: missing required fields must raise, not fall back to a pipeline default.
async def raises(layers):
    try:
        await pipeline.run(dict(base, layers=layers), no_cancel)
        return False
    except Exception:
        return True

dem_missing = dict(dem); dem_missing.pop("lowWeight")
incl_missing = dict(incl); incl_missing.pop("intersectWeight")
excl_missing = dict(excl); excl_missing.pop("noIntersectWeight")

dem_missing_raises = await raises([dem_missing])
incl_missing_raises = await raises([incl_missing])
excl_missing_raises = await raises([excl_missing])

json.dumps({
    "raw_is_score_times_weights": raw_ok,
    "dem_weight_values": dem_vals,
    "incl_weight_values": incl_vals,
    "excl_weight_values": excl_vals,
    "score_enhanced_sum": float(g["score_enhanced"].sum()),
    "top_cell_id": int(g.sort_values("score_enhanced", ascending=False).iloc[0]["cell_id"]),
    "rank_is_finite": bool(g["rank"].notna().all()),
    "dem_missing_raises": dem_missing_raises,
    "incl_missing_raises": incl_missing_raises,
    "excl_missing_raises": excl_missing_raises,
})
`));

  console.log(result);

  const checks = [
    [result.raw_is_score_times_weights, "score_enhanced_raw == score_raw * Π(weight columns)"],
    [JSON.stringify(result.dem_weight_values) === JSON.stringify([0, 0.4, 0.8]), `DEM weight column holds only configured values (got ${JSON.stringify(result.dem_weight_values)})`],
    [JSON.stringify(result.incl_weight_values) === JSON.stringify([0, 1]), `inclusion weight column holds only configured values (got ${JSON.stringify(result.incl_weight_values)})`],
    [JSON.stringify(result.excl_weight_values) === JSON.stringify([0, 1]), `exclusion weight column holds only configured values (got ${JSON.stringify(result.excl_weight_values)})`],
    [result.rank_is_finite, "ranking produced finite ranks"],
    [result.dem_missing_raises, "DEM LayerSpec missing lowWeight raises (no silent fallback)"],
    [result.incl_missing_raises, "inclusion LayerSpec missing intersectWeight raises"],
    [result.excl_missing_raises, "exclusion LayerSpec missing noIntersectWeight raises"],
  ];

  let ok = true;
  for (const [pass, label] of checks) {
    console.log(`${pass ? "ok" : "FAIL"}: ${label}`);
    if (!pass) ok = false;
  }

  if (!ok) {
    console.error("\nENV-WEIGHT-STRICT GOLDEN FAILED");
    process.exit(1);
  }
  console.log("\nENV-WEIGHT-STRICT GOLDEN PASSED");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

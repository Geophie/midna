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
  pyodide.FS.writeFile("/crimes.csv", `Latitude,Longitude\n33.749,-84.388\n33.759,-84.378\n33.739,-84.398\n`);

  const result = JSON.parse(await pyodide.runPythonAsync(`
import json, sys
import numpy as np
import geopandas as gpd
import rasterio
from rasterio.transform import from_origin

for p in ("/", "/webcore"):
    if p not in sys.path:
        sys.path.insert(0, p)

import core.aoi as aoi
import core.weights as weights
import pipeline

# A constant valid raster with explicit EPSG:4326, affine transform, extent,
# and no nodata value. Every sampled cell mean is exactly 275 m.
crimes = aoi.loadCrimesCsv("/crimes.csv", latCol="Latitude", lonCol="Longitude")
crimes = gpd.GeoDataFrame(crimes, geometry=gpd.points_from_xy(crimes["Longitude"], crimes["Latitude"]), crs="EPSG:4326")
area = aoi.computeAoiFromGdf(crimes, bufferPct=0.1)
minx, miny, maxx, maxy = area.total_bounds
with rasterio.open(
    "/constant-275.tif", "w", driver="GTiff", height=4, width=4, count=1,
    dtype="float64", crs="EPSG:4326",
    transform=from_origin(minx, maxy, (maxx - minx) / 4, (maxy - miny) / 4),
) as dst:
    dst.write(np.full((4, 4), 275.0, dtype=np.float64), 1)

assert np.allclose(
    weights._classifyDemValues(np.array([249.999, 250.0, 275.0])),
    [0.4, 0.8, 0.8],
), "default 250 m boundary changed"
assert np.allclose(
    weights._classifyDemValues(np.array([275.0]), collinaMin=300.0),
    [0.4],
), "explicit 300 m override changed"

async def no_cancel(frac, stage):
    return False

base = dict(
    crimes_csv_path="/crimes.csv", lat_col="Latitude", lon_col="Longitude",
    input_crs="EPSG:4326", analysis_crs="EPSG:4326",
    cells_x=2, cells_y=2, f=1.2, g=1.2, k=1.0, b_auto=True, b_value=0,
    engine="numpy", use_outliers=False, use_normalize=True, use_gini=False,
)
layer = dict(
    type="dem", name="dem", path="/constant-275.tif",
    pianuraMin=0.0, collinaMin=250.0, montagnaMin=350.0,
    lowWeight=0.4, midWeight=0.8, highWeight=1.0, nodataWeight=1.0,
)

# The browser LayerSpec always carries every DEM field and the pipeline now
# reads them with strict key access, so this passes collinaMin explicitly.
# 275 m sits in [250, 350) -> midWeight (0.8); raising the boundary to 300 m
# drops the same cell to [0, 300) -> lowWeight (0.4).
at_default = await pipeline.run(dict(base, layers=[layer]), no_cancel)
at_300 = await pipeline.run(dict(base, layers=[dict(layer, collinaMin=300.0)]), no_cancel)

def weights_from(result):
    frame = gpd.GeoDataFrame.from_features(json.loads(result["enhanced_geojson"])["features"])
    return frame["w_0_dem"].to_numpy(dtype=float), frame["dem_mean"].to_numpy(dtype=float)

default_weights, default_means = weights_from(at_default)
override_weights, override_means = weights_from(at_300)
assert np.allclose(default_means, 275.0) and np.allclose(override_means, 275.0)
assert np.allclose(default_weights, 0.8), default_weights
assert np.allclose(override_weights, 0.4), override_weights

json.dumps({
    "default_weight": float(default_weights[0]),
    "override_weight": float(override_weights[0]),
    "default_mean": float(default_means[0]),
    "override_mean": float(override_means[0]),
})
`));

  if (result.default_weight !== 0.8 || result.override_weight !== 0.4 || result.default_mean !== 275 || result.override_mean !== 275) {
    throw new Error(`Unexpected hillside-default result: ${JSON.stringify(result)}`);
  }
  console.log("HILLSIDE DEFAULT TEST PASSED", result);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

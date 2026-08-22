import { loadPyodide } from "pyodide";

const pyodide = await loadPyodide();
await pyodide.loadPackage(["rasterio", "fiona", "geopandas"]);

const out = await pyodide.runPythonAsync(`
import numpy as np
import rasterio
from rasterio.transform import from_origin
from rasterio.mask import mask
from shapely.geometry import box, mapping

import geopandas as gpd
_touch = gpd.GeoDataFrame({"a": [1]}, geometry=[box(0, 0, 1, 1)], crs="EPSG:4326")

arr = np.arange(100, dtype="float32").reshape(10, 10)
transform = from_origin(0.0, 10.0, 1.0, 1.0)
with rasterio.open(
    "/dem.tif", "w", driver="GTiff", height=10, width=10, count=1,
    dtype="float32", crs="EPSG:4326", transform=transform,
) as dst:
    dst.write(arr, 1)

with rasterio.open("/dem.tif") as src:
    geom = [mapping(box(2, 4, 7, 9))]
    clipped, _ = mask(src, geom, crop=True)

f"clipped shape={clipped.shape}, mean={float(clipped.mean()):.2f}"
`);
console.log("RESULT:", out);

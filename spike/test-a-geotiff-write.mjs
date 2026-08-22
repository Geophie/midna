import { loadPyodide } from "pyodide";

const pyodide = await loadPyodide();
await pyodide.loadPackage(["rasterio"]);

const out = await pyodide.runPythonAsync(`
import numpy as np
import rasterio
from rasterio.transform import from_origin

arr = np.arange(100, dtype="float32").reshape(10, 10)
transform = from_origin(0.0, 10.0, 1.0, 1.0)
with rasterio.open(
    "/dem.tif", "w", driver="GTiff", height=10, width=10, count=1,
    dtype="float32", crs="EPSG:4326", transform=transform,
) as dst:
    dst.write(arr, 1)
"square write ok"
`);
console.log("RESULT:", out);

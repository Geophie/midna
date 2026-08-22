import { loadPyodide } from "pyodide";

const pyodide = await loadPyodide();
await pyodide.loadPackage(["geopandas", "shapely"]);

const out = await pyodide.runPythonAsync(`
import geopandas as gpd
from shapely.geometry import box

gdf = gpd.GeoDataFrame(
    {"cell_id": [0, 1]},
    geometry=[box(0, 0, 1, 1), box(1, 0, 2, 1)],
    crs="EPSG:4326",
)
gdf.to_file("/test.geojson", driver="GeoJSON")
back = gpd.read_file("/test.geojson")
f"rows={len(back)}, crs={back.crs.to_string()}"
`);
console.log("RESULT:", out);

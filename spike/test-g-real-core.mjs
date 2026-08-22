import { loadPyodide } from "pyodide";
import fs from "node:fs";
import path from "node:path";

const CORE_SRC = path.resolve(
  "..",
  "..",
  "rossmo_toolkit",
  "core"
);
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

const pyodide = await loadPyodide();
await pyodide.loadPackage(["rasterio", "fiona", "geopandas"]);

pyodide.FS.mkdirTree("/core");
for (const f of CORE_FILES) {
  const content = fs.readFileSync(path.join(CORE_SRC, f), "utf-8");
  pyodide.FS.writeFile(`/core/${f}`, content);
}

const out = await pyodide.runPythonAsync(`
import sys
sys.path.insert(0, "/")

import numpy as np
import geopandas as gpd
from shapely.geometry import Point, box

import core.aoi as aoi
import core.grid as grid
import core.weights as weights

crimes_gdf = gpd.GeoDataFrame(
    {"id": [0, 1, 2]},
    geometry=[Point(0.0, 0.0), Point(0.1, 0.05), Point(0.05, 0.1)],
    crs="EPSG:4326",
)

aoi_gdf = aoi.computeAoiFromGdf(crimes_gdf, bufferPct=0.2)
grid_gdf = grid.createGrid(aoi_gdf, numCellsX=5, numCellsY=5)

minx, miny, maxx, maxy = aoi_gdf.total_bounds
import rasterio
from rasterio.transform import from_origin

width, height = 20, 20
transform = from_origin(minx, maxy, (maxx - minx) / width, (maxy - miny) / height)
dem_arr = np.arange(width * height, dtype="float32").reshape(height, width)
with rasterio.open(
    "/dem_source.tif", "w", driver="GTiff", height=height, width=width, count=1,
    dtype="float32", crs="EPSG:4326", transform=transform,
) as dst:
    dst.write(dem_arr, 1)

clipped_path = weights.clipDemToAoi("/dem_source.tif", aoi_gdf, "/dem_clipped.tif")
dem_values = weights.computeDemCellMeans(grid_gdf, clipped_path)
grid_gdf = weights.applyDemWeights(grid_gdf, dem_values)

incl_gdf = gpd.GeoDataFrame(
    {"name": ["zone"]}, geometry=[box(minx, miny, (minx + maxx) / 2, maxy)], crs="EPSG:4326"
)
incl_gdf.to_file("/incl.geojson", driver="GeoJSON")
incl_back = gpd.read_file("/incl.geojson")

grid_gdf = weights.applyInclusionLayer(grid_gdf, incl_back, "w_incl")

f"grid_rows={len(grid_gdf)}, cols={sorted(grid_gdf.columns.tolist())}, dem_mean_notnull={int(grid_gdf['dem_mean'].notna().sum())}, w_incl_sum={float(grid_gdf['w_incl'].sum())}"
`);
console.log("RESULT:", out);

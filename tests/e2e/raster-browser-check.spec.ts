import { expect, test } from "@playwright/test";

/**
 * Closes the one item Fase 0 left open: the rasterio+geopandas order-dependence
 * finding (see WebApp/docs/PHASE0_SPIKE_RESULTS.md) was only verified under
 * Node.js. This runs the same real core/ DEM path in an actual browser tab.
 */
test("rasterio + geopandas coexist correctly in a real browser (not just Node)", async ({
  page,
}) => {
  await page.goto("/");

  const coreFiles = [
    "aoi.py",
    "grid.py",
    "weights.py",
  ];
  const sources: Record<string, string> = {};
  for (const file of coreFiles) {
    sources[file] = await page
      .evaluate((f) => fetch(`/py/core/${f}`).then((r) => r.text()), file)
      .then((t) => t as string);
  }

  const result = await page.evaluate(async (sources) => {
    // @ts-expect-error dynamic runtime import of a static asset, not bundled
    const { loadPyodide } = await import("/pyodide/pyodide.mjs");
    const pyodide = await loadPyodide({ indexURL: "/pyodide/" });
    await pyodide.loadPackage(["rasterio", "fiona", "geopandas", "shapely"]);

    pyodide.FS.mkdirTree("/core");
    for (const [name, text] of Object.entries(sources)) {
      pyodide.FS.writeFile(`/core/${name}`, text as string);
    }

    const out = await pyodide.runPythonAsync(`
import sys
if "/" not in sys.path:
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

f"grid_rows={len(grid_gdf)} dem_mean_notnull={int(grid_gdf['dem_mean'].notna().sum())}"
`);
    return out as string;
  }, sources);

  expect(result).toBe("grid_rows=25 dem_mean_notnull=25");
});

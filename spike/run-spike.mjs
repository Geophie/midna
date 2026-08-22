import { loadPyodide } from "pyodide";

function makeHgtBuffer(side) {
  const buf = Buffer.alloc(side * side * 2);
  for (let i = 0; i < side * side; i++) {
    buf.writeInt16BE((i % 500) - 100, i * 2);
  }
  return buf;
}

async function main() {
  const results = {};

  console.log("Loading Pyodide 314.0.2 ...");
  const pyodide = await loadPyodide();

  console.log("Loading packages: rasterio, fiona, geopandas, shapely ...");
  await pyodide.loadPackage(["rasterio", "fiona", "geopandas", "shapely"]);
  results.packagesLoaded = true;

  const hgtSide = 1201;
  const hgtBuffer = makeHgtBuffer(hgtSide);
  pyodide.FS.writeFile("/N00E000.hgt", hgtBuffer);

  const pyOut = await pyodide.runPythonAsync(`
import json, zipfile, traceback

report = {}

def run(name, fn):
    try:
        report[name] = {"ok": True, "detail": fn()}
    except Exception as e:
        report[name] = {"ok": False, "detail": f"{type(e).__name__}: {e}", "trace": traceback.format_exc()}

def test_a_geotiff():
    import numpy as np
    import rasterio
    from rasterio.transform import from_origin
    from rasterio.mask import mask
    from shapely.geometry import box, mapping

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
    return f"clipped shape={clipped.shape}, mean={float(clipped.mean()):.2f}"

def test_b_hgt():
    import rasterio
    with rasterio.open("/N00E000.hgt") as src:
        shape_plain = (src.height, src.width)
        driver_plain = src.driver

    with zipfile.ZipFile("/N00E000.zip", "w") as zf:
        zf.write("/N00E000.hgt", arcname="N00E000.hgt")

    with rasterio.open("/vsizip//N00E000.zip/N00E000.hgt") as src:
        shape_zipped = (src.height, src.width)
        driver_zipped = src.driver

    assert shape_plain == shape_zipped, "shape mismatch plain vs zipped"
    return f"driver={driver_plain}, shape={shape_plain}, zipped driver={driver_zipped}"

def test_c_geopandas_gpkg():
    import geopandas as gpd
    from shapely.geometry import box

    gdf = gpd.GeoDataFrame(
        {"cell_id": [0, 1]},
        geometry=[box(0, 0, 1, 1), box(1, 0, 2, 1)],
        crs="EPSG:4326",
    )
    gdf.to_file("/test.gpkg", layer="baseline", driver="GPKG")
    back = gpd.read_file("/test.gpkg", layer="baseline")
    assert len(back) == 2, f"expected 2 rows, got {len(back)}"
    assert back.crs is not None, "CRS lost on round-trip"
    return f"rows={len(back)}, crs={back.crs.to_string()}, backend engine ok"

run("testA_geotiff_mask", test_a_geotiff)
run("testB_hgt_srtm_zipped", test_b_hgt)
run("testC_geopandas_gpkg_roundtrip", test_c_geopandas_gpkg)

json.dumps(report)
`);

  const pyResults = JSON.parse(pyOut);
  Object.assign(results, pyResults);

  console.log("\n=== Fase 0 spike results ===");
  console.log(JSON.stringify(results, null, 2));

  const allOk =
    results.testA_geotiff_mask?.ok &&
    results.testB_hgt_srtm_zipped?.ok &&
    results.testC_geopandas_gpkg_roundtrip?.ok;

  console.log(`\nVerdict: ${allOk ? "GO" : "NO-GO"}`);
  process.exitCode = allOk ? 0 : 1;
}

main().catch((err) => {
  console.error("Spike crashed:", err);
  process.exitCode = 1;
});

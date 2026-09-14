// Golden: optional DEM elevation bands below Plain and above Mountain.
//
// 1. Direct _classifyDemValues boundary checks for lower bands, upper bands,
//    and the full combined sequence (-200 < -50 < 0 < 250 < 350 < 700 < 1200).
// 2. Backward compatibility: the no-extra-band call is numerically identical
//    whether lowerBands/upperBands are omitted, explicitly None, or [].
// 3. End-to-end through pipeline.run: a cell whose elevation falls inside an
//    extra band receives that band's weight, and a run with no lowerBands/
//    upperBands keys in the LayerSpec (as every pre-existing fixture
//    constructs it) matches a run with them explicitly empty.
// 4. _classifyDemStates: NaN (genuine NoData) and a finite elevation below
//    the lowest configured threshold both still resolve to nodataWeight
//    numerically, but must classify to different diagnostic states.

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

# --- 1a. Lower bands: -200 (0.2), -50 (0.3), Plain=0 (0.4), Hillside=250 (0.8), Mountain=350 (0.5)
lower_vals = np.array([-201.0, -200.0, -199.999, -50.0, -49.999, 0.0, 249.999, 250.0, 349.999, 350.0])
lower_w = weights._classifyDemValues(
    lower_vals, pianuraMin=0.0, collinaMin=250.0, montagnaMin=350.0,
    lowWeight=0.4, midWeight=0.8, highWeight=0.5, nodataWeight=-1.0,
    lowerBands=[(-200.0, 0.2), (-50.0, 0.3)],
)
assert np.allclose(lower_w, [-1.0, 0.2, 0.2, 0.3, 0.3, 0.4, 0.4, 0.8, 0.8, 0.5]), list(lower_w)

# --- 1b. Upper bands: Plain=0, Hillside=250, Mountain=350 (0.5), 700 (0.2), 1200 (0.1)
upper_vals = np.array([349.999, 350.0, 699.999, 700.0, 1199.999, 1200.0, 2000.0])
upper_w = weights._classifyDemValues(
    upper_vals, pianuraMin=0.0, collinaMin=250.0, montagnaMin=350.0,
    lowWeight=0.4, midWeight=0.8, highWeight=0.5, nodataWeight=-1.0,
    upperBands=[(700.0, 0.2), (1200.0, 0.1)],
)
assert np.allclose(upper_w, [0.8, 0.5, 0.5, 0.2, 0.2, 0.1, 0.1]), list(upper_w)

# --- 1c. Combined full sequence, including below-lowest and NaN
combined_vals = np.array([-250.0, -200.0, -50.0, 0.0, 250.0, 350.0, 700.0, 1200.0, 5000.0, np.nan])
combined_w = weights._classifyDemValues(
    combined_vals, pianuraMin=0.0, collinaMin=250.0, montagnaMin=350.0,
    lowWeight=0.4, midWeight=0.8, highWeight=0.5, nodataWeight=-9.0,
    lowerBands=[(-200.0, 0.2), (-50.0, 0.3)],
    upperBands=[(700.0, 0.2), (1200.0, 0.1)],
)
assert np.allclose(combined_w, [-9.0, 0.2, 0.3, 0.4, 0.8, 0.5, 0.2, 0.1, 0.1, -9.0]), list(combined_w)

# --- 2. Backward compatibility at the _classifyDemValues level ---
base_vals = np.array([-10.0, 0.0, 100.0, 249.999, 250.0, 300.0, 350.0, 500.0, np.nan])
legacy = weights._classifyDemValues(base_vals)
omitted = weights._classifyDemValues(base_vals, lowerBands=None, upperBands=None)
empty = weights._classifyDemValues(base_vals, lowerBands=[], upperBands=[])
assert np.array_equal(legacy, omitted, equal_nan=True), (list(legacy), list(omitted))
assert np.array_equal(legacy, empty, equal_nan=True), (list(legacy), list(empty))

# --- 4. DEM below-configured-range vs true NoData diagnostic states ---
# lowerBands=[(-200, 0.2)], pianuraMin=0, collinaMin=250, montagnaMin=350.
diag_vals = np.array([np.nan, -300.0, -200.0, -199.999, 0.0])
diag_kwargs = dict(
    pianuraMin=0.0, collinaMin=250.0, montagnaMin=350.0,
    lowWeight=0.4, midWeight=0.8, highWeight=0.0,
    lowerBands=[(-200.0, 0.2)],
)
diag_states = weights._classifyDemStates(diag_vals, **diag_kwargs)
diag_weights = weights._classifyDemValues(diag_vals, nodataWeight=-1.0, **diag_kwargs)

states_match_expected = list(diag_states) == [
    weights.DEM_STATE_NODATA, weights.DEM_STATE_BELOW_RANGE, weights.DEM_STATE_IN_RANGE,
    weights.DEM_STATE_IN_RANGE, weights.DEM_STATE_IN_RANGE,
]
# NaN and the below-range value share nodataWeight numerically (backward
# compatibility) yet must carry different diagnostic states.
nodata_and_below_range_share_weight = bool(diag_weights[0] == diag_weights[1] == -1.0)
nodata_and_below_range_states_differ = bool(diag_states[0] != diag_states[1])

async def no_cancel(frac, stage):
    return False

pyparams_base = dict(
    crimes_csv_path="/crimes.csv", lat_col="Latitude", lon_col="Longitude",
    input_crs="EPSG:4326", analysis_crs="EPSG:4326",
    cells_x=2, cells_y=2, f=1.2, g=1.2, k=1.0, b_auto=True, b_value=0,
    engine="numpy", use_outliers=False, use_normalize=True, use_gini=False,
)

crimes = aoi.loadCrimesCsv("/crimes.csv", latCol="Latitude", lonCol="Longitude")
crimes = gpd.GeoDataFrame(crimes, geometry=gpd.points_from_xy(crimes["Longitude"], crimes["Latitude"]), crs="EPSG:4326")
area = aoi.computeAoiFromGdf(crimes, bufferPct=0.1)
minx, miny, maxx, maxy = area.total_bounds

def constant_raster(rpath, value):
    with rasterio.open(
        rpath, "w", driver="GTiff", height=4, width=4, count=1,
        dtype="float64", crs="EPSG:4326",
        transform=from_origin(minx, maxy, (maxx - minx) / 4, (maxy - miny) / 4),
    ) as dst:
        dst.write(np.full((4, 4), value, dtype=np.float64), 1)

# --- 3a. End-to-end: a cell inside a lower band gets that band's weight ---
constant_raster("/below-plain.tif", -100.0)
layer_with_lower = dict(
    type="dem", name="dem", path="/below-plain.tif",
    pianuraMin=0.0, collinaMin=250.0, montagnaMin=350.0,
    lowWeight=0.4, midWeight=0.8, highWeight=0.0, nodataWeight=-1.0,
    lowerBands=[{"threshold": -200.0, "weight": 0.2}, {"threshold": -50.0, "weight": 0.3}],
)
out_lower = await pipeline.run(dict(pyparams_base, layers=[layer_with_lower]), no_cancel)
frame_lower = gpd.GeoDataFrame.from_features(json.loads(out_lower["enhanced_geojson"])["features"])
lower_e2e_weights = sorted(set(np.round(frame_lower["w_0_dem"].to_numpy(dtype=float), 6).tolist()))

# --- 3b. End-to-end: a cell inside an upper band gets that band's weight ---
constant_raster("/above-mountain.tif", 900.0)
layer_with_upper = dict(
    type="dem", name="dem", path="/above-mountain.tif",
    pianuraMin=0.0, collinaMin=250.0, montagnaMin=350.0,
    lowWeight=0.4, midWeight=0.8, highWeight=0.0, nodataWeight=-1.0,
    upperBands=[{"threshold": 700.0, "weight": 0.2}, {"threshold": 1200.0, "weight": 0.1}],
)
out_upper = await pipeline.run(dict(pyparams_base, layers=[layer_with_upper]), no_cancel)
frame_upper = gpd.GeoDataFrame.from_features(json.loads(out_upper["enhanced_geojson"])["features"])
upper_e2e_weights = sorted(set(np.round(frame_upper["w_0_dem"].to_numpy(dtype=float), 6).tolist()))

# --- 3c. End-to-end backward compatibility: a LayerSpec with no lowerBands/
# upperBands keys at all (every pre-existing fixture) vs the same layer with
# them explicitly empty — must be numerically identical downstream.
constant_raster("/hillside.tif", 275.0)
layer_no_bands_key = dict(
    type="dem", name="dem", path="/hillside.tif",
    pianuraMin=0.0, collinaMin=250.0, montagnaMin=350.0,
    lowWeight=0.4, midWeight=0.8, highWeight=0.0, nodataWeight=0.0,
)
layer_empty_bands = dict(layer_no_bands_key, lowerBands=[], upperBands=[])
out_no_key = await pipeline.run(dict(pyparams_base, layers=[layer_no_bands_key]), no_cancel)
out_empty = await pipeline.run(dict(pyparams_base, layers=[layer_empty_bands]), no_cancel)
frame_no_key = gpd.GeoDataFrame.from_features(json.loads(out_no_key["enhanced_geojson"])["features"]).sort_values("cell_id").reset_index(drop=True)
frame_empty = gpd.GeoDataFrame.from_features(json.loads(out_empty["enhanced_geojson"])["features"]).sort_values("cell_id").reset_index(drop=True)
backward_compat_ok = bool(
    np.allclose(frame_no_key["w_0_dem"].to_numpy(dtype=float), frame_empty["w_0_dem"].to_numpy(dtype=float))
    and np.allclose(frame_no_key["score_enhanced"].to_numpy(dtype=float), frame_empty["score_enhanced"].to_numpy(dtype=float))
    and np.array_equal(frame_no_key["rank"].to_numpy(), frame_empty["rank"].to_numpy())
)

json.dumps({
    "lower_e2e_weights": lower_e2e_weights,
    "upper_e2e_weights": upper_e2e_weights,
    "backward_compat_ok": backward_compat_ok,
    "diag_states": list(diag_states),
    "diag_states_match_expected": states_match_expected,
    "diag_nodata_and_below_range_share_weight": nodata_and_below_range_share_weight,
    "diag_nodata_and_below_range_states_differ": nodata_and_below_range_states_differ,
})
`));

  console.log(result);

  const checks = [
    [
      JSON.stringify(result.lower_e2e_weights) === JSON.stringify([0.2]),
      `-100m cell falls in lower band [-200,-50) -> weight 0.2 (got ${JSON.stringify(result.lower_e2e_weights)})`,
    ],
    [
      JSON.stringify(result.upper_e2e_weights) === JSON.stringify([0.2]),
      `900m cell falls in upper band [700,1200) -> weight 0.2 (got ${JSON.stringify(result.upper_e2e_weights)})`,
    ],
    [
      result.backward_compat_ok,
      "no-extra-class run is numerically identical whether lowerBands/upperBands keys are omitted or explicitly empty",
    ],
    [
      result.diag_states_match_expected,
      `NaN/-300/-200/-199.999/0 classify as nodata/below_range/in_range/in_range/in_range (got ${JSON.stringify(result.diag_states)})`,
    ],
    [
      result.diag_nodata_and_below_range_share_weight,
      "NaN and a finite below-range value still share the same numerical nodataWeight (backward compatibility)",
    ],
    [
      result.diag_nodata_and_below_range_states_differ,
      "...but NaN and a finite below-range value classify to different diagnostic states",
    ],
  ];

  let ok = true;
  for (const [pass, label] of checks) {
    console.log(`${pass ? "ok" : "FAIL"}: ${label}`);
    if (!pass) ok = false;
  }

  if (!ok) {
    console.error("\nDEM EXTRA BANDS GOLDEN FAILED");
    process.exit(1);
  }
  console.log("\nDEM EXTRA BANDS GOLDEN PASSED");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

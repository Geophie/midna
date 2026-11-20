// Golden: the browser pipeline reads every environmental field with strict key
// access. A fully-populated valid LayerSpec produces the exact same weighted
// surface as before (weights.py math untouched); a LayerSpec missing a required
// field now fails loudly instead of silently substituting a pipeline default.
//
// Also covers the post-weighting finite-value safeguard: individually finite,
// non-negative environmental weights whose product overflows float64 must
// fail the run explicitly (error_env_overflow) before normalization ever
// gets a chance to silently zero the overflow out — while a very large but
// still-finite product keeps running normally.
//
// Section I: the Python-side _validate_env_layers mirrors
// src/lib/validateEnvWeights.ts, so invalid DEM thresholds/weights and
// out-of-order threshold sequences fail with error_env_weight_invalid or
// error_env_threshold_order when run() is called directly.
// Section J: a positive score whose weighted product underflows to 0 is treated like an explicit weight 0 (zero_weight_applied, excluded, anchor_excluded).

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
import core.normalize as normalize
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

# --- Post-weighting finite-value safeguard --------------------------------
# Two inclusion layers covering the whole AOI, each individually finite and
# >= 0 (1e200 passes validateEnvWeights.ts's per-field contract), whose
# product (1e200 * 1e200 = 1e400) exceeds float64 range regardless of the
# Rossmo score magnitude — deterministic, not machine-specific.
gpd.GeoDataFrame({"name": ["full"]}, geometry=[box(minx, miny, maxx, maxy)], crs="EPSG:4326").to_file("/full.geojson", driver="GeoJSON")
overflow_layer = dict(type="inclusion", name="ov", path="/full.geojson",
                       intersectWeight=1e200, noIntersectWeight=1e200)

overflow_message = None
try:
    await pipeline.run(dict(base, layers=[overflow_layer, overflow_layer]), no_cancel)
    overflow_raised = False
except Exception as e:
    overflow_raised = True
    overflow_message = str(e)
overflow_error_key_present = bool(overflow_message and "error_env_overflow" in overflow_message)

# A very large but still float64-safe product (1e100) must keep running
# normally end to end, including normalization.
safe_layer = dict(type="inclusion", name="safe", path="/full.geojson",
                   intersectWeight=1e100, noIntersectWeight=1e100)
safe_out = await pipeline.run(dict(base, layers=[safe_layer]), no_cancel)
safe_g = gpd.GeoDataFrame.from_features(json.loads(safe_out["enhanced_geojson"])["features"])
safe_raw_finite = bool(np.isfinite(safe_g["score_enhanced_raw"].to_numpy(dtype=float)).all())
safe_normalized_max = float(safe_g["score_enhanced"].max())

# Prove the guard is load-bearing: absent it, normalize.py's existing
# finite-fallback would silently turn the overflow into an apparently valid
# zero score rather than surfacing it.
demo_gdf = gpd.GeoDataFrame({"score_enhanced": [1.0, np.inf, 2.0]})
demo_normalized = normalize.normalizeScores(demo_gdf, col="score_enhanced")
normalize_silently_zeroes_inf = bool(demo_normalized["score_enhanced"].iloc[1] == 0.0)

# I: Python-side validation mirrors validateEnvWeights.ts. Each invalid variant
# must fail with its error key; the returned message is None if run() succeeds.
async def run_error(layers):
    try:
        await pipeline.run(dict(base, layers=layers), no_cancel)
        return None
    except Exception as e:
        return str(e)

weight_invalid_cases = {
    "dem_nodata_negative": dict(dem, nodataWeight=-1.0),
    "incl_intersect_inf": dict(incl, intersectWeight=float("inf")),
    "incl_intersect_nan": dict(incl, intersectWeight=float("nan")),
    "dem_lower_band_negative_weight": dict(dem, lowerBands=[{"threshold": -100.0, "weight": -0.2}]),
    "dem_pianura_bool": dict(dem, pianuraMin=True),
}
threshold_order_cases = {
    "dem_collina_equals_pianura": dict(dem, collinaMin=dem["pianuraMin"]),
    "dem_lower_band_at_pianura": dict(dem, lowerBands=[{"threshold": dem["pianuraMin"], "weight": 0.2}]),
    "dem_upper_band_at_montagna": dict(dem, upperBands=[{"threshold": dem["montagnaMin"], "weight": 0.2}]),
}
weight_invalid_messages = {name: await run_error([layer]) for name, layer in weight_invalid_cases.items()}
threshold_order_messages = {name: await run_error([layer]) for name, layer in threshold_order_cases.items()}

# J: positive underflow is treated like weight 0. Two layers of 1e-200 give a
# product of 1e-400, which underflows to 0.0 for every cell; 1e-100 each gives
# 1e-200, still representable (control). Anchor = mean of the crimes points.
anchor_lat = float(crimes["Latitude"].mean())
anchor_lon = float(crimes["Longitude"].mean())

def uf_layer(w):
    return dict(type="inclusion", name="uf", path="/full.geojson",
                intersectWeight=w, noIntersectWeight=w)

async def uf_run(w):
    out_j = await pipeline.run(dict(base, layers=[uf_layer(w), uf_layer(w)],
                                    anchor_lat=anchor_lat, anchor_lon=anchor_lon), no_cancel)
    flags = gpd.GeoDataFrame.from_features(json.loads(out_j["enhanced_geojson"])["features"])["zero_weight_applied"].astype(bool)
    return dict(
        all_flagged=bool(flags.all()),
        any_flagged=bool(flags.any()),
        status=out_j["enhanced_eval"]["status"],
        eligible_area_fraction=float(out_j["enhanced_eval"]["eligible_area_fraction"]),
    )

uf_underflow = await uf_run(1e-200)
uf_control = await uf_run(1e-100)

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
    "overflow_raised": overflow_raised,
    "overflow_message": overflow_message,
    "overflow_error_key_present": overflow_error_key_present,
    "safe_raw_finite": safe_raw_finite,
    "safe_normalized_max": safe_normalized_max,
    "normalize_silently_zeroes_inf": normalize_silently_zeroes_inf,
    "weight_invalid_messages": weight_invalid_messages,
    "threshold_order_messages": threshold_order_messages,
    "uf_underflow": uf_underflow,
    "uf_control": uf_control,
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
    [result.overflow_raised, "environmental multiplication overflowing float64 fails the run explicitly"],
    [result.overflow_error_key_present, `overflow failure carries the error_env_overflow key (got ${JSON.stringify(result.overflow_message ?? null)})`],
    [result.safe_raw_finite, "a very large but still float64-safe weight product stays finite"],
    [result.safe_normalized_max === 100, `the safe large-weight run still normalizes to max 100 (got ${result.safe_normalized_max})`],
    [result.normalize_silently_zeroes_inf, "sanity: normalize.py's own finite-fallback would have silently zeroed the overflow — this is exactly what the pre-normalization guard prevents from being reached"],
    ...Object.entries(result.weight_invalid_messages).map(([name, msg]) => [
      typeof msg === "string" && msg.includes("error_env_weight_invalid"),
      `I weight_invalid ${name}: message contains error_env_weight_invalid (got ${JSON.stringify(msg)})`,
    ]),
    ...Object.entries(result.threshold_order_messages).map(([name, msg]) => [
      typeof msg === "string" && msg.includes("error_env_threshold_order"),
      `I threshold_order ${name}: message contains error_env_threshold_order (got ${JSON.stringify(msg)})`,
    ]),
    [result.uf_underflow.all_flagged, `J underflow: every enhanced cell has zero_weight_applied True (got ${JSON.stringify(result.uf_underflow)})`],
    [result.uf_underflow.status === "anchor_excluded", `J underflow: anchor status is anchor_excluded (got ${JSON.stringify(result.uf_underflow)})`],
    [result.uf_underflow.eligible_area_fraction === 0, `J underflow: eligible_area_fraction === 0 (got ${JSON.stringify(result.uf_underflow)})`],
    [!result.uf_control.any_flagged, `J control: no cell has zero_weight_applied True (got ${JSON.stringify(result.uf_control)})`],
    [result.uf_control.status === "valid", `J control: anchor status is valid (got ${JSON.stringify(result.uf_control)})`],
    [result.uf_control.eligible_area_fraction === 1, `J control: eligible_area_fraction === 1 (got ${JSON.stringify(result.uf_control)})`],
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

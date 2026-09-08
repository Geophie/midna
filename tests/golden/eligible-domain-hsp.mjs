// Finding 3 — full-AOI HSP vs eligible-domain HSP.
// Runs the real public/py pipeline under Pyodide and checks that:
//   * full-AOI hit_score_pct is unchanged (recomputed independently in JS);
//   * eligible-domain HSP uses only cells with zero_weight_applied == false;
//   * eligible_area_fraction reports domain contraction;
//   * with no hard exclusions, eligible HSP == full-AOI HSP and fraction == 1;
//   * out_of_domain -> eligible HSP null, fraction still defined.
import { loadPyodide } from "pyodide";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..");
const CORE_SRC = path.join(root, "public", "py", "core");
const PIPELINE_SRC = path.join(root, "public", "py", "webcore", "pipeline.py");
const CORE_FILES = [
  "aoi.py", "buffer_zone.py", "grid.py", "outliers.py", "rossmo_numpy.py",
  "rossmo_loop.py", "weights.py", "normalize.py", "ranking.py", "evaluation.py", "stats.py",
];

const CRIMES_CSV = `Latitude,Longitude
33.7490,-84.3880
33.7590,-84.3780
33.7390,-84.3980
33.7690,-84.3680
33.7290,-84.4080
33.7550,-84.3750
`;

// Independent JS recompute of HSP from the returned enhanced GeoJSON.
function recompute(featuresGeoJson, anchorScore) {
  const feats = JSON.parse(featuresGeoJson).features.map((f) => f.properties);
  const total = feats.length;
  const eligible = feats.filter((p) => p.zero_weight_applied !== true);
  const fullNum = feats.filter((p) => p.score_enhanced >= anchorScore).length;
  const eligNum = eligible.filter((p) => p.score_enhanced >= anchorScore).length;
  return {
    fullAoiHsp: (100 * fullNum) / total,
    eligibleHsp: eligible.length ? (100 * eligNum) / eligible.length : null,
    eligibleCells: eligible.length,
    totalCells: total,
  };
}

async function main() {
  if (!fs.existsSync(path.join(CORE_SRC, "aoi.py"))) {
    console.error("public/py/core not found — run `npm run prepare:assets` first.");
    process.exit(1);
  }
  const pyodide = await loadPyodide();
  await pyodide.loadPackage(["numpy", "pandas", "geopandas", "shapely", "fiona"]);

  pyodide.FS.mkdirTree("/core");
  pyodide.FS.mkdirTree("/webcore");
  for (const f of CORE_FILES) {
    pyodide.FS.writeFile(`/core/${f}`, fs.readFileSync(path.join(CORE_SRC, f), "utf-8"));
  }
  pyodide.FS.writeFile("/webcore/pipeline.py", fs.readFileSync(PIPELINE_SRC, "utf-8"));
  pyodide.FS.writeFile("/crimes.csv", CRIMES_CSV);

  const resultJson = await pyodide.runPythonAsync(`
import sys, json
for p in ("/", "/webcore"):
    if p not in sys.path:
        sys.path.insert(0, p)

import geopandas as gpd
from shapely.geometry import box
import core.aoi as aoi
import pipeline

crimes = aoi.loadCrimesCsv("/crimes.csv", latCol="Latitude", lonCol="Longitude")
crimes = gpd.GeoDataFrame(crimes, geometry=gpd.points_from_xy(crimes["Longitude"], crimes["Latitude"]), crs="EPSG:4326")
aoi_gdf = aoi.computeAoiFromGdf(crimes)
minx, miny, maxx, maxy = aoi_gdf.total_bounds
midx = (minx + maxx) / 2

# Exclusion polygon over the WEST half of the AOI (anchor sits in the east).
gpd.GeoDataFrame({"name": ["w"]}, geometry=[box(minx, miny, midx, maxy)], crs="EPSG:4326").to_file(
    "/excl_west.geojson", driver="GeoJSON")
# "Layer present but no hard exclusion": weight 1.0 whether it intersects or not.
gpd.GeoDataFrame({"name": ["all"]}, geometry=[box(minx, miny, maxx, maxy)], crs="EPSG:4326").to_file(
    "/incl_all.geojson", driver="GeoJSON")

async def no_cancel(frac, stage):
    return False

BASE = dict(
    crimes_csv_path="/crimes.csv", lat_col="Latitude", lon_col="Longitude",
    input_crs="EPSG:4326", analysis_crs="EPSG:4326",
    cells_x=30, cells_y=30, f=1.2, g=1.2, k=1.0, b_auto=True, b_value=0,
    engine="numpy", use_outliers=False, outlier_threshold_multiplier=2.0,
    use_normalize=True, use_gini=True, layers=[],
)
EXCL = {"type": "exclusion", "name": "w", "path": "/excl_west.geojson",
        "intersectWeight": 0.0, "noIntersectWeight": 1.0}
INCL_NOOP = {"type": "inclusion", "name": "all", "path": "/incl_all.geojson",
             "intersectWeight": 1.0, "noIntersectWeight": 1.0}

# Case 1 — domain contraction, anchor eligible (east half).
o1 = await pipeline.run(dict(BASE, layers=[EXCL], anchor_lat=33.7550, anchor_lon=-84.3760), no_cancel)
# Case 2 — layer present, NO hard exclusion anywhere.
o2 = await pipeline.run(dict(BASE, layers=[INCL_NOOP], anchor_lat=33.7550, anchor_lon=-84.3760), no_cancel)
# Case 3 — anchor outside the grid, exclusion layer present.
o3 = await pipeline.run(dict(BASE, layers=[EXCL], anchor_lat=40.0, anchor_lon=-100.0), no_cancel)

json.dumps({
    "c1": {"baseline_eval": o1["baseline_eval"], "enhanced_eval": o1["enhanced_eval"],
           "enhanced_geojson": o1["enhanced_geojson"]},
    "c2": {"enhanced_eval": o2["enhanced_eval"], "enhanced_geojson": o2["enhanced_geojson"]},
    "c3": {"enhanced_eval": o3["enhanced_eval"]},
})
`);

  const r = JSON.parse(resultJson);
  let ok = true;
  const fail = (m) => { console.error("FAIL: " + m); ok = false; };
  const near = (a, b, tol = 1e-9) => typeof a === "number" && typeof b === "number" && Math.abs(a - b) <= tol;

  // ---- Case 1: contraction, anchor eligible ----
  const e1 = r.c1.enhanced_eval;
  const b1 = r.c1.baseline_eval;
  if (e1.status !== "valid") fail(`c1 expected enhanced status 'valid', got '${e1.status}'`);
  const rc1 = recompute(r.c1.enhanced_geojson, e1.anchor_score);
  if (!near(e1.hit_score_pct, rc1.fullAoiHsp)) fail(`c1 full-AOI HSP ${e1.hit_score_pct} != independent ${rc1.fullAoiHsp}`);
  if (!near(e1.eligible_hit_score_pct, rc1.eligibleHsp)) fail(`c1 eligible HSP ${e1.eligible_hit_score_pct} != independent ${rc1.eligibleHsp}`);
  if (e1.eligible_cells !== rc1.eligibleCells) fail(`c1 eligible_cells ${e1.eligible_cells} != ${rc1.eligibleCells}`);
  if (!(e1.eligible_area_fraction > 0 && e1.eligible_area_fraction < 0.95)) fail(`c1 eligible_area_fraction should reflect contraction (0,0.95), got ${e1.eligible_area_fraction}`);
  if (!near(b1.eligible_hit_score_pct, b1.hit_score_pct)) fail(`c1 baseline eligible HSP ${b1.eligible_hit_score_pct} != baseline full-AOI HSP ${b1.hit_score_pct}`);
  if (b1.eligible_area_fraction !== 1) fail(`c1 baseline eligible_area_fraction must be 1.0, got ${b1.eligible_area_fraction}`);
  console.log(
    `Case 1 (west half excluded, anchor east):\n` +
    `  full-AOI HSP        = ${e1.hit_score_pct.toFixed(4)} %\n` +
    `  eligible-domain HSP = ${e1.eligible_hit_score_pct.toFixed(4)} %\n` +
    `  eligible-area frac  = ${e1.eligible_area_fraction.toFixed(4)}  (${e1.eligible_cells}/${e1.total_cells} cells)\n` +
    `  -> the full-AOI HSP counts an anchor score against ${e1.total_cells} cells; the eligible-domain\n` +
    `     HSP against only the ${e1.eligible_cells} cells that survive the hard exclusion, so a low\n` +
    `     full-AOI HSP that is really domain contraction is now visible as frac < 1.`
  );

  // ---- Case 2: no hard exclusion -> eligible == full, frac == 1 ----
  const e2 = r.c2.enhanced_eval;
  if (e2.status !== "valid") fail(`c2 expected enhanced status 'valid', got '${e2.status}'`);
  if (!near(e2.eligible_area_fraction, 1, 1e-12)) fail(`c2 eligible_area_fraction must be 1.0, got ${e2.eligible_area_fraction}`);
  if (!near(e2.eligible_hit_score_pct, e2.hit_score_pct)) fail(`c2 eligible HSP ${e2.eligible_hit_score_pct} != full-AOI HSP ${e2.hit_score_pct}`);
  if (e2.eligible_cells !== e2.total_cells) fail(`c2 eligible_cells ${e2.eligible_cells} != total_cells ${e2.total_cells}`);
  console.log(`Case 2 (no hard exclusion): eligible HSP == full-AOI HSP == ${e2.hit_score_pct.toFixed(4)} %, frac = ${e2.eligible_area_fraction}`);

  // ---- Case 3: out_of_domain ----
  const e3 = r.c3.enhanced_eval;
  if (e3.status !== "out_of_domain") fail(`c3 expected 'out_of_domain', got '${e3.status}'`);
  if (e3.eligible_hit_score_pct !== null) fail(`c3 eligible_hit_score_pct must be null, got ${e3.eligible_hit_score_pct}`);
  if (!(typeof e3.eligible_area_fraction === "number" && e3.eligible_area_fraction > 0 && e3.eligible_area_fraction <= 1))
    fail(`c3 eligible_area_fraction should still be defined in (0,1], got ${e3.eligible_area_fraction}`);
  console.log(`Case 3 (out_of_domain): eligible HSP = ${e3.eligible_hit_score_pct}, frac = ${e3.eligible_area_fraction.toFixed(4)}`);

  if (!ok) { console.error("\nELIGIBLE-DOMAIN HSP TEST FAILED"); process.exit(1); }
  console.log("\nELIGIBLE-DOMAIN HSP TEST PASSED");
}

main().catch((err) => { console.error("test crashed:", err); process.exit(1); });

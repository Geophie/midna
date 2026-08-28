import { loadPyodide } from "pyodide";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..");
const CORE_SRC = path.join(root, "public", "py", "core");
const PIPELINE_SRC = path.join(root, "public", "py", "webcore", "pipeline.py");
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

const CRIMES_CSV = `Latitude,Longitude
33.7490,-84.3880
33.7590,-84.3780
33.7390,-84.3980
33.7690,-84.3680
33.7290,-84.4080
33.7550,-84.3750
34.5000,-85.5000
`;

// Golden values captured from a trusted run of this exact fixture/params
// (DEM + inclusion + exclusion layers, outlier removal, anchor point).
// Regenerate deliberately (never to "make it pass") if core/ or pipeline
// math changes.
const GOLDEN = {
  enhancedScoreSum: null, // filled after first trusted run, see below
};

async function main() {
  if (!fs.existsSync(path.join(CORE_SRC, "aoi.py"))) {
    console.error("public/py/core not found — run `npm run prepare:assets` first.");
    process.exit(1);
  }

  const pyodide = await loadPyodide();
  await pyodide.loadPackage(["numpy", "pandas", "geopandas", "shapely", "rasterio", "fiona"]);

  pyodide.FS.mkdirTree("/core");
  pyodide.FS.mkdirTree("/webcore");
  for (const file of CORE_FILES) {
    pyodide.FS.writeFile(`/core/${file}`, fs.readFileSync(path.join(CORE_SRC, file), "utf-8"));
  }
  pyodide.FS.writeFile("/webcore/pipeline.py", fs.readFileSync(PIPELINE_SRC, "utf-8"));
  pyodide.FS.writeFile("/enhanced_crimes.csv", CRIMES_CSV);

  const resultJson = await pyodide.runPythonAsync(`
import sys, json
for p in ("/", "/webcore"):
    if p not in sys.path:
        sys.path.insert(0, p)

import numpy as np
import geopandas as gpd
import rasterio
from rasterio.transform import from_origin
from shapely.geometry import box

import core.aoi as aoi
import core.outliers as outliers
import core.stats as stats
import pipeline

crimes_gdf = aoi.loadCrimesCsv("/enhanced_crimes.csv", latCol="Latitude", lonCol="Longitude")
crimes_gdf = gpd.GeoDataFrame(
    crimes_gdf,
    geometry=gpd.points_from_xy(crimes_gdf["Longitude"], crimes_gdf["Latitude"]),
    crs="EPSG:4326",
)
fixture_crimes, _ = outliers.removeOutliers(crimes_gdf, thresholdMultiplier=1.5)
aoi_gdf = aoi.computeAoiFromGdf(fixture_crimes)
minx, miny, maxx, maxy = aoi_gdf.total_bounds

width, height = 30, 30
transform = from_origin(minx, maxy, (maxx - minx) / width, (maxy - miny) / height)
dem_arr = np.linspace(0, 500, width * height, dtype="float32").reshape(height, width)
with rasterio.open(
    "/enhanced_dem.tif", "w", driver="GTiff", height=height, width=width, count=1,
    dtype="float32", crs="EPSG:4326", transform=transform,
) as dst:
    dst.write(dem_arr, 1)

incl_gdf = gpd.GeoDataFrame(
    {"name": ["zone"]},
    geometry=[box(minx, miny, (minx + maxx) / 2, maxy)],
    crs="EPSG:4326",
)
incl_gdf.to_file("/enhanced_incl.geojson", driver="GeoJSON")

excl_gdf = gpd.GeoDataFrame(
    {"name": ["zone"]},
    geometry=[box((minx + maxx) / 2, miny, maxx, (miny + maxy) / 2)],
    crs="EPSG:4326",
)
excl_gdf.to_file("/enhanced_excl.geojson", driver="GeoJSON")

async def no_cancel(frac, stage):
    return False

base_params = {
    "crimes_csv_path": "/enhanced_crimes.csv",
    "lat_col": "Latitude",
    "lon_col": "Longitude",
    "input_crs": "EPSG:4326",
    "analysis_crs": "EPSG:4326",
    "cells_x": 15,
    "cells_y": 15,
    "f": 1.2,
    "g": 1.2,
    "k": 1.0,
    "b_auto": True,
    "b_value": 0,
    "use_outliers": True,
    "outlier_threshold_multiplier": 1.5,
    "anchor_lat": 33.7500,
    "anchor_lon": -84.3850,
    "layers": [
        {
            "type": "dem", "name": "dem", "path": "/enhanced_dem.tif",
            "pianuraMin": 0, "collinaMin": 150, "montagnaMin": 350,
            "lowWeight": 1.0, "midWeight": 0.6, "highWeight": 0.2, "nodataWeight": 0.0,
        },
        {
            "type": "inclusion", "name": "incl", "path": "/enhanced_incl.geojson",
            "intersectWeight": 1.0, "noIntersectWeight": 0.3,
        },
        {
            "type": "exclusion", "name": "excl", "path": "/enhanced_excl.geojson",
            "intersectWeight": 0.0, "noIntersectWeight": 1.0,
        },
    ],
}

results = {}
for engine in ("numpy", "loop"):
    params = dict(base_params, engine=engine)
    outcome = await pipeline.run(params, no_cancel)
    scored = gpd.GeoDataFrame.from_features(json.loads(outcome["enhanced_geojson"])["features"])
    baseline = gpd.GeoDataFrame.from_features(json.loads(outcome["baseline_geojson"])["features"])
    expected_gini = stats.computeGini(baseline["score_raw"].to_numpy())
    ordered = scored.sort_values("rank")
    boundary = baseline.sort_values("cell_id")["score_raw"].to_numpy().reshape(15, 15)
    edge_mask = np.zeros(boundary.shape, dtype=bool)
    edge_mask[[0, -1], :] = True
    edge_mask[:, [0, -1]] = True
    edge = boundary[edge_mask]
    filtered, _ = outliers.removeOutliers(crimes_gdf, thresholdMultiplier=1.5)
    expected_bounds = aoi.computeAoiFromGdf(filtered).total_bounds
    results[engine] = {
        "score_enhanced_sum": float(scored["score_enhanced"].sum()),
        "n_cells": outcome["n_cells"],
        "n_crimes": outcome["n_crimes"],
        "outliers_removed": outcome["outliers_removed"],
        "baseline_gini": outcome["baseline_gini"],
        "enhanced_gini": outcome["enhanced_gini"],
        "baseline_hit_score_pct": outcome["baseline_eval"]["hit_score_pct"] if outcome["baseline_eval"] else None,
        "enhanced_hit_score_pct": outcome["enhanced_eval"]["hit_score_pct"] if outcome["enhanced_eval"] else None,
        "raw_min": float(baseline["score_raw"].min()),
        "raw_max": float(baseline["score_raw"].max()),
        "normalized_min": float(baseline["score"].min()),
        "normalized_max": float(baseline["score"].max()),
        "valid_baseline_zero_count": int((baseline["score"] == 0).sum()),
        "zero_weight_count": int(scored["zero_weight_applied"].sum()),
        "zero_weight_raw_zero_count": int((scored.loc[scored["zero_weight_applied"], "score_enhanced_raw"] == 0).sum()),
        "ranks_follow_raw": bool(ordered["score_enhanced_raw"].is_monotonic_decreasing),
        "gini_matches_raw": bool(abs(outcome["baseline_gini"] - expected_gini) < 1e-12),
        "boundary_matches_raw": bool(
            abs(outcome["boundary_diagnostics"]["peak_raw"] - boundary.max()) < 1e-12
            and abs(outcome["boundary_diagnostics"]["edge_max_raw"] - edge.max()) < 1e-12
            and abs(outcome["boundary_diagnostics"]["edge_mean_raw"] - edge.mean()) < 1e-12
            and abs(outcome["boundary_diagnostics"]["edge_p95_raw"] - np.percentile(edge, 95)) < 1e-12
            and abs(outcome["boundary_diagnostics"]["edge_peak_ratio"] - edge.max() / boundary.max()) < 1e-12
        ),
        "aoi_unchanged": bool(np.allclose(baseline.total_bounds, expected_bounds, rtol=0, atol=1e-12)),
    }

json.dumps(results)
`);

  const results = JSON.parse(resultJson);
  console.log(results);

  let ok = true;

  const diff = Math.abs(results.numpy.score_enhanced_sum - results.loop.score_enhanced_sum);
  if (diff > 1e-6) {
    console.error(`FAIL: numpy vs loop engines diverge on enhanced score, diff=${diff}`);
    ok = false;
  } else {
    console.log(`ok: numpy and loop engines agree on enhanced model (diff=${diff})`);
  }

  if (results.numpy.outliers_removed < 1) {
    console.error("FAIL: expected at least 1 outlier removed with this fixture/threshold");
    ok = false;
  } else {
    console.log(`ok: outlier removal ran (${results.numpy.outliers_removed} removed)`);
  }

  // Normalization is max-only (score / max * 100): a strictly positive raw
  // score must stay strictly positive — normalization never manufactures a
  // zero, so it cannot be mistaken for a zero-weighted cell.
  const expectedNormMin =
    (results.numpy.raw_min / results.numpy.raw_max) * 100;
  if (
    !(
      results.numpy.raw_min > 0 &&
      results.numpy.normalized_min > 0 &&
      Math.abs(results.numpy.normalized_min - expectedNormMin) < 1e-9 &&
      Math.abs(results.numpy.normalized_max - 100) < 1e-9
    )
  ) {
    console.error("FAIL: baseline max-only normalization did not preserve a positive minimum");
    ok = false;
  }
  // Zero provenance stays unambiguous: the only zeros on the normalized
  // baseline are cells whose raw score was already zero, and every
  // zero-weighted enhanced cell has a raw enhanced score of zero.
  if (!(results.numpy.valid_baseline_zero_count === 0 && results.numpy.zero_weight_count > 0 &&
        results.numpy.zero_weight_raw_zero_count === results.numpy.zero_weight_count)) {
    console.error("FAIL: normalized-zero and zero-weight provenance are not distinguishable");
    ok = false;
  }
  if (!results.numpy.ranks_follow_raw || !results.numpy.gini_matches_raw) {
    console.error("FAIL: ranking or Gini changed from its raw-score basis");
    ok = false;
  }
  if (!results.numpy.boundary_matches_raw || !results.numpy.aoi_unchanged) {
    console.error("FAIL: boundary diagnostics or automatic AOI bounds changed");
    ok = false;
  }

  if (results.numpy.baseline_hit_score_pct === null || results.numpy.enhanced_hit_score_pct === null) {
    console.error("FAIL: expected anchor point evaluation to produce hit scores");
    ok = false;
  } else {
    console.log(
      `ok: anchor evaluation produced hit scores (baseline=${results.numpy.baseline_hit_score_pct}, enhanced=${results.numpy.enhanced_hit_score_pct})`
    );
  }

  if (GOLDEN.enhancedScoreSum !== null) {
    if (Math.abs(results.numpy.score_enhanced_sum - GOLDEN.enhancedScoreSum) > 1e-6) {
      console.error(
        `FAIL: enhanced score_sum regressed. golden=${GOLDEN.enhancedScoreSum} got=${results.numpy.score_enhanced_sum}`
      );
      ok = false;
    } else {
      console.log(`ok: enhanced score_sum matches golden (${results.numpy.score_enhanced_sum})`);
    }
  } else {
    console.log(
      `NOTE: no golden value pinned yet for enhancedScoreSum — captured ${results.numpy.score_enhanced_sum}, pin it in this file.`
    );
  }

  if (!ok) {
    console.error("\nGOLDEN TEST FAILED");
    process.exit(1);
  }
  console.log("\nGOLDEN TEST PASSED");
}

main().catch((err) => {
  console.error("golden test crashed:", err);
  process.exit(1);
});

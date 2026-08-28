import sys

if "/" not in sys.path:
    sys.path.insert(0, "/")

import zipfile

import numpy as np
import pandas as pd
import geopandas as gpd
from shapely.geometry import Point, box

import core.aoi as aoi
import core.grid as grid
import core.buffer_zone as buffer_zone
import core.rossmo_numpy as rossmo_numpy
import core.rossmo_loop as rossmo_loop
import core.outliers as outliers
import core.weights as weights
import core.normalize as normalize
import core.ranking as ranking
import core.stats as stats
import core.evaluation as evaluation


def _lorenz_dict(values):
    x, y = stats.computeLorenz(values)
    return {"x": x.tolist(), "y": y.tolist()}


def _boundary_diagnostics(scored_gdf, cells_x, cells_y):
    scores = scored_gdf.sort_values("cell_id")["score"].to_numpy(dtype=float)
    cell_ids = scored_gdf.sort_values("cell_id")["cell_id"].to_numpy(dtype=int)
    if len(scores) != cells_x * cells_y or not np.array_equal(cell_ids, np.arange(len(scores))):
        return None
    surface = scores.reshape(cells_y, cells_x)
    edge_mask = np.zeros(surface.shape, dtype=bool)
    edge_mask[[0, -1], :] = True
    edge_mask[:, [0, -1]] = True
    edge = surface[edge_mask]
    peak = float(scores.max())
    edge_max = float(edge.max())
    return {
        "peak_raw": peak,
        "edge_max_raw": edge_max,
        "edge_mean_raw": float(edge.mean()),
        "edge_p95_raw": float(np.percentile(edge, 95)),
        "edge_peak_ratio": edge_max / peak if peak != 0 else None,
    }


def _load_geodata(path, lat_col, lon_col, input_crs, analysis_crs):
    """Mirrors the desktop app's `_load_geodata` (app_dpg.py): CSV points via
    lat/lon columns, anything else via gpd.read_file — same validation and
    error-key vocabulary, reused for the anchor point, a custom grid, and
    inclusion/exclusion layers."""
    if path.lower().endswith(".csv"):
        df = pd.read_csv(path)
        resolved_lat_col, resolved_lon_col = aoi.resolveCsvColumnNames(df.columns, lat_col, lon_col)
        if resolved_lat_col not in df.columns or resolved_lon_col not in df.columns:
            raise ValueError("error_csv_columns")
        if df.empty:
            raise ValueError("error_file_empty")
        for col in (resolved_lat_col, resolved_lon_col):
            if not pd.api.types.is_numeric_dtype(df[col]):
                raise ValueError("error_col_not_numeric")
            if df[col].isnull().any() or np.isinf(df[col]).any():
                raise ValueError("error_col_invalid_values")
        gdf = gpd.GeoDataFrame(
            df, geometry=gpd.points_from_xy(df[resolved_lon_col], df[resolved_lat_col]), crs=input_crs
        )
        return gdf if str(gdf.crs) == str(analysis_crs) else gdf.to_crs(analysis_crs)

    gdf = _read_vector_file(path)
    if not hasattr(gdf, "to_crs"):
        raise ValueError("error_no_valid_geometries")
    if gdf.crs is None:
        raise ValueError("error_no_crs")
    if gdf.empty:
        raise ValueError("error_file_no_geometries")
    return gdf.to_crs(analysis_crs)


def _read_vector_file(path):
    """gpd.read_file, with zipped-shapefile support via GDAL's /vsizip/: try
    the bare zip path first (GDAL auto-detects a lone shapefile inside, same
    mechanism Phase 0 proved for zipped HGT rasters); if that fails because
    the archive holds more than just the one dataset, list it with the
    stdlib zipfile module to find the .shp member and retry disambiguated."""
    if not path.lower().endswith(".zip"):
        return gpd.read_file(path)
    try:
        return gpd.read_file(f"/vsizip/{path}")
    except Exception:
        with zipfile.ZipFile(path) as zf:
            shp_members = [n for n in zf.namelist() if n.lower().endswith(".shp")]
        if not shp_members:
            raise ValueError("error_no_valid_geometries")
        return gpd.read_file(f"/vsizip/{path}/{shp_members[0]}")


async def run(params, progress_cb):
    """Cancellation is an expected outcome, not an error: a cancelled run
    returns {"status": "cancelled"} rather than raising, so callers don't
    have to distinguish "user clicked Stop" from a real failure via
    exception message sniffing."""

    # Checkpoint-based, like the desktop app's _set_progress: cancellation is
    # only observed between stages, never mid-computation and never after the
    # 0.85 checkpoint. Acceptable since that tail is fast; revisit only if it
    # grows.
    async def should_cancel(frac, stage):
        cancelled = await progress_cb(frac, stage)
        return frac < 1.0 and cancelled

    # --- Step 1: load crimes -------------------------------------------------
    if await should_cancel(0.05, "load"):
        return {"status": "cancelled"}
    df = aoi.loadCrimesCsv(
        params["crimes_csv_path"],
        latCol=params["lat_col"],
        lonCol=params["lon_col"],
    )
    lat_col, lon_col = aoi.resolveCsvColumnNames(df.columns, params["lat_col"], params["lon_col"])
    crimes_gdf = gpd.GeoDataFrame(
        df,
        geometry=gpd.points_from_xy(df[lon_col], df[lat_col]),
        crs=params["input_crs"],
    )
    if str(crimes_gdf.crs) != str(params["analysis_crs"]):
        crimes_gdf = crimes_gdf.to_crs(params["analysis_crs"])

    crimes_xy_total = np.array([(geom.x, geom.y) for geom in crimes_gdf.geometry])
    if len(crimes_xy_total) < 2:
        raise ValueError("error_too_few_crimes")
    if np.all(crimes_xy_total == crimes_xy_total[0]):
        raise ValueError("error_crimes_identical")

    # --- Step 2: outlier removal + grid/AOI (auto grid, or custom grid) ------
    if await should_cancel(0.15, "grid"):
        return {"status": "cancelled"}
    outlier_stats = None
    grid_path = params.get("grid_path")
    if grid_path:
        # Custom grid provided: skip outlier-based AOI/grid extent, but still
        # apply outlier removal to the crime set used by the Rossmo formula
        # itself — matches the desktop app's behaviour exactly.
        grid_gdf = _load_geodata(grid_path, params["lat_col"], params["lon_col"],
                                  params["input_crs"], params["analysis_crs"])
        if "cell_id" not in grid_gdf.columns:
            grid_gdf["cell_id"] = range(len(grid_gdf))
        invalid = set(grid_gdf.geom_type.unique()) - {"Polygon", "MultiPolygon"}
        if invalid:
            raise ValueError("error_grid_not_polygon")
        aoi_gdf = gpd.GeoDataFrame(geometry=[box(*grid_gdf.total_bounds)], crs=grid_gdf.crs)

        crimes_xy_formula = crimes_xy_total
        if params.get("use_outliers", False):
            crimes_gdf_filtered, outlier_stats = outliers.removeOutliers(
                crimes_gdf, thresholdMultiplier=params.get("outlier_threshold_multiplier", 2.0)
            )
            crimes_xy_formula = np.array([(g.x, g.y) for g in crimes_gdf_filtered.geometry])
    else:
        crimes_gdf_aoi = crimes_gdf
        if params.get("use_outliers", False):
            crimes_gdf_aoi, outlier_stats = outliers.removeOutliers(
                crimes_gdf, thresholdMultiplier=params.get("outlier_threshold_multiplier", 2.0)
            )

        crimes_xy_formula = np.array([(g.x, g.y) for g in crimes_gdf_aoi.geometry])
        # Outer bounding-box padding, percent per side (default 10).
        # Ignored on the custom-grid path above.
        buffer_pct = float(params.get("aoi_padding_pct", 10.0)) / 100.0
        aoi_gdf = aoi.computeAoiFromGdf(crimes_gdf_aoi, bufferPct=buffer_pct)
        grid_gdf = grid.createGrid(aoi_gdf, params["cells_x"], params["cells_y"])

    lon, lat, _lonlat_msg = grid.resolveLonlat(grid_gdf)
    grid_gdf["Longitude"] = lon
    grid_gdf["Latitude"] = lat

    # Crimes-per-cell, exported per grid cell for downstream consumers — built
    # from the exact same point set used for the Rossmo formula itself, so it
    # stays consistent with outlier removal / grid choice above.
    crimes_join_gdf = gpd.GeoDataFrame(
        geometry=[Point(x, y) for x, y in crimes_xy_formula], crs=grid_gdf.crs
    )
    joined = gpd.sjoin(
        crimes_join_gdf, grid_gdf[["cell_id", "geometry"]], predicate="within", how="left"
    )
    crime_counts = joined.groupby("cell_id").size()
    grid_gdf["crime_count"] = grid_gdf["cell_id"].map(crime_counts).fillna(0).astype(int)

    if params.get("b_auto", True):
        b_value = buffer_zone.computeBufferZone(crimes_xy_formula)
    else:
        b_value = params["b_value"]

    # --- Step 3: Rossmo score -------------------------------------------------
    if await should_cancel(0.35, "rossmo"):
        return {"status": "cancelled"}
    if params.get("engine", "numpy") == "numpy":
        scored_gdf = rossmo_numpy.rossmoNumpy(
            grid_gdf, crimes_xy_formula, b_value, params["f"], params["g"], params.get("k", 1.0)
        )
    else:
        scored_gdf = rossmo_loop.rossmoLoop(
            grid_gdf, crimes_xy_formula, b_value, params["f"], params["g"], params.get("k", 1.0)
        )
    scored_gdf["score_raw"] = scored_gdf["score"]
    boundary_diagnostics = None if grid_path else _boundary_diagnostics(
        scored_gdf, params["cells_x"], params["cells_y"]
    )
    baseline_gdf = ranking.rankCells(scored_gdf.copy(), col="score")

    # --- Step 4: weight layers -> score_enhanced ------------------------------
    if await should_cancel(0.55, "layers"):
        return {"status": "cancelled"}
    weight_cols = []
    dem_seen = False
    for idx, layer in enumerate(params.get("layers", [])):
        raw_name = (layer.get("name") or "").strip()
        col_name = f"w_{idx}_{raw_name}" if raw_name else f"w_{idx}"
        label = raw_name or col_name
        if layer["type"] == "dem":
            if dem_seen:
                continue  # UI already enforces a single DEM; ignore extras defensively
            dem_seen = True
            clipped_path = weights.clipDemToAoi(layer["path"], aoi_gdf)
            dem_values = weights.computeDemCellMeans(scored_gdf, clipped_path)
            scored_gdf = weights.applyDemWeights(
                scored_gdf,
                dem_values,
                pianuraMin=layer.get("pianuraMin", 0.0),
                collinaMin=layer.get("collinaMin", 220.0),
                montagnaMin=layer.get("montagnaMin", 350.0),
                lowWeight=layer.get("lowWeight", 0.4),
                midWeight=layer.get("midWeight", 0.8),
                highWeight=layer.get("highWeight", 0.0),
                nodataWeight=layer.get("nodataWeight", 0.0),
            )
            scored_gdf = scored_gdf.rename(columns={"w_dem": col_name})
            # Diagnostic parity with the desktop app's per-layer debug log
            # (app_dpg.py ~1104-1111) — same "elevation min/max/nodata" shape,
            # surfaced through the execution log instead of a log file so the
            # two can be compared side by side when debugging a divergence.
            valid_dem = dem_values[~np.isnan(dem_values)]
            nodata_count = int(np.isnan(dem_values).sum())
            if len(valid_dem):
                await progress_cb(
                    0.55,
                    f"DEM '{label}': elevation min={valid_dem.min():.0f}m "
                    f"max={valid_dem.max():.0f}m mean={valid_dem.mean():.1f}m nodata={nodata_count}",
                )
            else:
                await progress_cb(0.55, f"DEM '{label}': nessun valore valido, nodata={nodata_count}")
        else:
            layer_gdf = _load_geodata(layer["path"], params["lat_col"], params["lon_col"],
                                       params["input_crs"], params["analysis_crs"])
            if layer["type"] == "exclusion":
                # float(...) is required here: pyodide.toPy() sends a whole-number
                # JS value (e.g. 1) as a Python int, which locks the pandas column
                # to int64 on first assignment in applyIntersectionLayer — the other
                # weight then fails to fit if it's a decimal (pandas LossySetitemError).
                intersect_weight = float(layer.get("intersectWeight", 0.0))
                scored_gdf = weights.applyExclusionLayer(
                    scored_gdf,
                    layer_gdf,
                    col_name,
                    intersectWeight=intersect_weight,
                    noIntersectWeight=float(layer.get("noIntersectWeight", 1.0)),
                )
            else:
                intersect_weight = float(layer.get("intersectWeight", 1.0))
                scored_gdf = weights.applyInclusionLayer(
                    scored_gdf,
                    layer_gdf,
                    col_name,
                    intersectWeight=intersect_weight,
                    noIntersectWeight=float(layer.get("noIntersectWeight", 0.0)),
                )
            # Diagnostic parity with the desktop app's "{type} layer '{name}':
            # N/M cells" debug log (app_dpg.py ~1112-1118).
            n_intersecting = int((scored_gdf[col_name] == intersect_weight).sum())
            await progress_cb(
                0.55,
                f"{layer['type']} '{label}': {n_intersecting}/{len(scored_gdf)} celle",
            )
        weight_cols.append(col_name)

    score_col = "score"
    enhanced_gdf = None
    if weight_cols:
        scored_gdf = weights.applyWeights(scored_gdf, weight_cols)
        scored_gdf["effective_weight"] = scored_gdf[weight_cols].prod(axis=1)
        scored_gdf["zero_weight_applied"] = scored_gdf[weight_cols].eq(0).any(axis=1)
        scored_gdf["score_enhanced_raw"] = scored_gdf["score_enhanced"]
        score_col = "score_enhanced"

    # --- Step 5: Gini (on raw scores, before normalization) + normalize ------
    if await should_cancel(0.70, "stats"):
        return {"status": "cancelled"}
    use_gini = params.get("use_gini", True)
    use_normalize = params.get("use_normalize", True)

    baseline_gini = stats.computeGini(baseline_gdf["score"].to_numpy()) if use_gini else None
    enhanced_gini = (
        stats.computeGini(scored_gdf[score_col].to_numpy()) if use_gini and weight_cols else None
    )

    if use_normalize:
        if weight_cols:
            scored_gdf = normalize.normalizeScores(scored_gdf, col=score_col)
        baseline_gdf = normalize.normalizeScores(baseline_gdf, col="score")

    if weight_cols:
        # Keep the enhanced frame's "score" column in sync with the
        # (now-normalized) baseline, mapped by cell_id — same trick as the
        # desktop app, so one exported table shows baseline+enhanced together.
        baseline_norm_by_cell = baseline_gdf.set_index("cell_id")["score"]
        scored_gdf["score"] = scored_gdf["cell_id"].map(baseline_norm_by_cell)
        enhanced_gdf = ranking.rankCells(scored_gdf, col=score_col)

    baseline_lorenz = _lorenz_dict(baseline_gdf["score"].to_numpy())
    enhanced_lorenz = _lorenz_dict(enhanced_gdf[score_col].to_numpy()) if weight_cols else None

    # --- Step 6: anchor point evaluation --------------------------------------
    if await should_cancel(0.85, "eval"):
        return {"status": "cancelled"}
    baseline_eval = None
    enhanced_eval = None
    anchor_path = params.get("anchor_path")
    anchor_geom = None
    if anchor_path:
        # File-based anchor takes priority over manual lat/lon — only the
        # first geometry in the file is used, matching the desktop app.
        anchor_gdf = _load_geodata(anchor_path, params["lat_col"], params["lon_col"],
                                    params["input_crs"], params["analysis_crs"])
        if anchor_gdf.empty:
            raise ValueError("error_anchor_empty")
        anchor_geom = anchor_gdf.geometry.iloc[0]
    elif params.get("anchor_lat") is not None and params.get("anchor_lon") is not None:
        anchor_series = gpd.GeoSeries(
            [Point(params["anchor_lon"], params["anchor_lat"])], crs="EPSG:4326"
        )
        if str(anchor_series.crs) != str(params["analysis_crs"]):
            anchor_series = anchor_series.to_crs(params["analysis_crs"])
        anchor_geom = anchor_series.iloc[0]

    if anchor_geom is not None:
        baseline_hit = evaluation.computeHitScore(baseline_gdf, anchor_geom)
        baseline_area = evaluation.computeSearchArea(baseline_gdf, baseline_hit["anchor_score"])
        baseline_eval = {**baseline_hit, **baseline_area}

        if weight_cols:
            enhanced_hit = evaluation.computeHitScore(enhanced_gdf, anchor_geom, score_col)
            enhanced_area = evaluation.computeSearchArea(
                enhanced_gdf, enhanced_hit["anchor_score"], score_col
            )
            enhanced_eval = {**enhanced_hit, **enhanced_area}

    await progress_cb(1.0, "done")

    return {
        "status": "done",
        "b": float(b_value),
        "n_cells": int(len(baseline_gdf)),
        "cells_x": None if grid_path else int(params["cells_x"]),
        "cells_y": None if grid_path else int(params["cells_y"]),
        "n_crimes": int(len(crimes_xy_formula)),
        "n_crimes_total": int(len(crimes_xy_total)),
        "outliers_removed": int(outlier_stats["n_removed"]) if outlier_stats else 0,
        "baseline_gini": float(baseline_gini) if baseline_gini is not None else None,
        "enhanced_gini": float(enhanced_gini) if enhanced_gini is not None else None,
        "baseline_lorenz": baseline_lorenz,
        "enhanced_lorenz": enhanced_lorenz,
        "baseline_eval": baseline_eval,
        "enhanced_eval": enhanced_eval,
        "boundary_diagnostics": boundary_diagnostics,
        "baseline_geojson": baseline_gdf.to_json(),
        "enhanced_geojson": enhanced_gdf.to_json() if enhanced_gdf is not None else None,
    }

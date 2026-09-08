import numpy as np
import geopandas as gpd
from shapely.geometry import Point

_METRIC_UNITS = {"metre", "meter"}


def _metricView(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Returns gdf in a metre-based CRS so `.distance()` yields metres and
    `.area` yields m^2. Geographic CRSs *and* projected CRSs whose linear unit
    is not the metre (e.g. US survey-foot State Plane zones) are reprojected to
    their local UTM zone; a CRS already in metres is returned unchanged."""
    crs = gdf.crs
    if crs is None:
        return gdf
    already_metric = not crs.is_geographic and {ax.unit_name for ax in crs.axis_info} <= _METRIC_UNITS
    return gdf if already_metric else gdf.to_crs(gdf.estimate_utm_crs())


def computeHitScore(gridGdf: gpd.GeoDataFrame, anchorPoint: Point, scoreCol: str = "score") -> dict:
    """
    Computes the hit score percentage for a known anchor point.

    Finds the grid cell nearest to the anchor point, retrieves its rank,
    and computes the hit score percentage (lower = better model performance).

    Parameters:
        gridGdf      : ranked GeoDataFrame with 'rank' and score columns
        anchorPoint  : known offender residence as a Shapely Point
        scoreCol     : score column to evaluate

    Returns:
        dict with anchor_rank, n_cells, hit_score_pct, anchor_score, distance_to_nearest_cell_m
    """

    if gridGdf.empty:
        raise ValueError("Cannot evaluate hit score on an empty grid.")

    # Distances/areas must be in metres regardless of the analysis CRS's unit.
    metricGdf = _metricView(gridGdf)
    if gridGdf.crs is not None and str(metricGdf.crs) != str(gridGdf.crs):
        metricAnchor = (
            gpd.GeoDataFrame(geometry=[anchorPoint], crs=gridGdf.crs).to_crs(metricGdf.crs).geometry.iloc[0]
        )
    else:
        metricAnchor = anchorPoint

    contained = metricGdf[metricGdf.geometry.covers(metricAnchor)]
    is_contained = not contained.empty

    if is_contained:
        centDists = contained.geometry.centroid.distance(metricAnchor)
        nearestIdx = centDists.idxmin()
        distance = 0.0
    else:
        # This metric-CRS diagnostic is the minimum distance to a grid-cell
        # footprint, not to a cell centroid. An outside anchor has no anchor cell,
        # so it must not inherit the nearest cell's score, rank, HSP, or
        # home-guess distance.
        distances = metricGdf.geometry.distance(metricAnchor)
        distance = float(np.float64(distances.min()))  # type: ignore
        return {
            "is_contained": False,
            "anchor_cell_idx": None,
            "anchor_rank": None,
            "n_cells": len(gridGdf),
            "hit_score_pct": None,
            "anchor_score": None,
            "distance_to_nearest_cell_m": distance,
            "home_guess_distance_m": None,
        }

    anchorScore = float(np.float64(gridGdf.loc[nearestIdx, scoreCol]))  # type: ignore
    anchorRank = int(np.int64(gridGdf.loc[nearestIdx, "rank"]))  # type: ignore
    topIdx = gridGdf["rank"].idxmin()
    homeGuessDistance = float(metricGdf.geometry.centroid.loc[topIdx].distance(metricAnchor))  # type: ignore
    hsp = float((gridGdf[scoreCol] >= anchorScore).sum() / len(gridGdf) * 100)

    return {
        "is_contained": is_contained,
        "anchor_cell_idx": nearestIdx,
        "anchor_rank": anchorRank,
        "n_cells": len(gridGdf),
        "hit_score_pct": float(hsp),
        "anchor_score": anchorScore,
        "distance_to_nearest_cell_m": distance,
        "home_guess_distance_m": homeGuessDistance
    }


def computeSearchArea(gridGdf: gpd.GeoDataFrame, anchorScore: float | None, scoreCol: str = "score") -> dict:
    """
    Computes the prioritized search area based on the anchor cell score.

    Counts all cells with score >= anchorScore and calculates their total area.
    The lower the search area relative to the AOI, the better the model performance.

    Parameters:
        gridGdf      : GeoDataFrame with a score column
        anchorScore  : score of the cell containing the known anchor point
        scoreCol     : score column to evaluate

    Returns:
        dict with n_priority_cells, search_area_km2, total_cells, hit_score_pct
    """

    if gridGdf.empty:
        raise ValueError("Cannot compute search area on an empty grid.")

    if anchorScore is None:
        return {
            "n_priority_cells": None,
            "search_area_km2": None,
            "total_cells": len(gridGdf),
            "hit_score_pct": None
        }

    priorityCells = gridGdf[gridGdf[scoreCol] >= anchorScore]
    if priorityCells.empty:
        return {"n_priority_cells": 0, "search_area_km2": 0.0, "total_cells": len(gridGdf), "hit_score_pct": 0.0}
    areaCells = _metricView(priorityCells)
    areaKm2 = float(areaCells.geometry.area.sum() / 1e6)

    return {
        "n_priority_cells": len(priorityCells),
        "search_area_km2": areaKm2,
        "total_cells": len(gridGdf),
        "hit_score_pct": float(len(priorityCells) / len(gridGdf) * 100)
    }


def computeEligibleMetrics(
    gridGdf: gpd.GeoDataFrame,
    anchorScore: float | None,
    eligibleMask=None,
    scoreCol: str = "score",
) -> dict:
    """
    Eligible-domain companion to computeHitScore / computeSearchArea (audit
    Finding 3: full-AOI HSP vs eligible-domain HSP).

    Adds a second Hit Score whose denominator is the *eligible* search domain
    only, so a lower full-AOI HSP that merely reflects environmental
    domain contraction can be told apart from a genuine ranking improvement.

    Parameters:
        gridGdf      : ranked/scored GeoDataFrame (same frame computeHitScore saw)
        anchorScore  : the eligible anchor cell's score on `scoreCol`, or None
                       when the anchor is not a valid, eligible, in-domain point
                       (status out_of_domain / anchor_excluded) — then
                       eligible_hit_score_pct is None
        eligibleMask : boolean array/Series aligned to gridGdf rows, True where
                       the cell is eligible, i.e. MIDNA's
                       `zero_weight_applied == False`. None means "every cell
                       eligible" (a surface with no environmental hard
                       exclusions, e.g. the baseline model)
        scoreCol     : score column to threshold on

    This never redefines `hit_score_pct`: with an all-True mask the eligible
    HSP is numerically identical to computeHitScore's full-AOI HSP (same
    `score >= anchorScore` tie rule, denominator = every cell).

    Returns:
        dict with eligible_hit_score_pct, eligible_area_fraction (0..1),
        eligible_cells, total_cells, eligible_area_km2
    """

    if gridGdf.empty:
        raise ValueError("Cannot compute eligible-domain metrics on an empty grid.")

    n_total = len(gridGdf)
    if eligibleMask is None:
        elig = np.ones(n_total, dtype=bool)
    else:
        elig = np.asarray(eligibleMask, dtype=bool)
        if elig.shape != (n_total,):
            raise ValueError(
                f"eligibleMask length ({elig.shape}) does not match gridGdf ({n_total})."
            )
    n_elig = int(elig.sum())

    # Area-based fraction: reuse the exact metre-CRS view computeSearchArea
    # uses, so a geographic analysis CRS never contributes square degrees and
    # unequal-area (custom-grid) cells are weighted by real area, not count.
    areas = _metricView(gridGdf).geometry.area.to_numpy(dtype=float)
    total_area = float(areas.sum())
    if total_area > 0:
        eligible_area = float(areas[elig].sum())
        eligible_area_fraction = eligible_area / total_area
        eligible_area_km2 = eligible_area / 1e6
    else:
        eligible_area_fraction = None
        eligible_area_km2 = None

    if anchorScore is None or n_elig == 0:
        eligible_hsp = None
    else:
        atOrAbove = gridGdf[scoreCol].to_numpy(dtype=float) >= anchorScore
        eligible_hsp = float((atOrAbove & elig).sum() / n_elig * 100)

    return {
        "eligible_hit_score_pct": eligible_hsp,
        "eligible_area_fraction": eligible_area_fraction,
        "eligible_cells": n_elig,
        "total_cells": n_total,
        "eligible_area_km2": eligible_area_km2,
    }


if __name__ == "__main__":
    from shapely.geometry import box

    gdf = gpd.GeoDataFrame(
        {"score": [1, 2], "score_enhanced": [3, 1], "rank": [2, 1]},
        geometry=[box(12.0, 45.0, 12.01, 45.01), box(12.01, 45.0, 12.02, 45.01)],
        crs="EPSG:4326",
    )
    assert computeSearchArea(gdf, 3, "score_enhanced")["n_priority_cells"] == 1
    assert computeSearchArea(gdf, 3, "score_enhanced")["search_area_km2"] > 0.1
    hit = computeHitScore(gdf, gdf.geometry.iloc[0].centroid)
    assert hit["distance_to_nearest_cell_m"] == 0
    assert hit["home_guess_distance_m"] > 0

    # A US survey-foot projected CRS must report the SAME metres/km^2 as a
    # metre-based CRS covering the same ground, not foot-inflated numbers.
    atl = gpd.GeoDataFrame(
        {"score": [1.0, 2.0, 3.0], "rank": [3, 2, 1]},
        geometry=[box(-84.40, 33.74, -84.39, 33.75),
                  box(-84.39, 33.74, -84.38, 33.75),
                  box(-84.38, 33.74, -84.37, 33.75)],
        crs="EPSG:4326",
    )
    ft = atl.to_crs("EPSG:2240")   # NAD83 / Georgia West (ftUS)
    m = atl.to_crs("EPSG:26967")   # NAD83 / Georgia West (metres)
    a_ft = computeSearchArea(ft, 1.0)["search_area_km2"]
    a_m = computeSearchArea(m, 1.0)["search_area_km2"]
    assert abs(a_ft - a_m) / a_m < 1e-3, (a_ft, a_m)
    h_ft = computeHitScore(ft, ft.geometry.iloc[0].centroid)["home_guess_distance_m"]
    h_m = computeHitScore(m, m.geometry.iloc[0].centroid)["home_guess_distance_m"]
    assert abs(h_ft - h_m) / h_m < 1e-3, (h_ft, h_m)
    print("OK: foot-based CRS reports metres consistently with a metre CRS")

    # --- Finding 3: eligible-domain HSP + eligible-area fraction -----------
    # 10 equal-area cells, scores 1..10, anchor score 7.
    g10 = gpd.GeoDataFrame(
        {"score": [float(s) for s in range(1, 11)]},
        geometry=[box(12.0 + i * 0.01, 45.0, 12.0 + (i + 1) * 0.01, 45.01) for i in range(10)],
        crs="EPSG:4326",
    )
    # eligible = cells with score in {2,6,7,10}; among them {7,10} are >= 7 -> 2/4.
    elig10 = np.array([s in (2, 6, 7, 10) for s in range(1, 11)])
    em = computeEligibleMetrics(g10, anchorScore=7.0, eligibleMask=elig10, scoreCol="score")
    assert em["eligible_cells"] == 4 and em["total_cells"] == 10, em
    assert abs(em["eligible_hit_score_pct"] - 50.0) < 1e-9, em
    # ~0.4 for 4/10 nominally-equal cells; not exactly 0.4 because the metre-CRS
    # reprojection gives each cell a slightly different true area — which is the
    # point: this is an AREA fraction, not a cell count.
    assert abs(em["eligible_area_fraction"] - 0.4) < 2e-3, em

    # All-eligible invariant: eligible HSP == full-AOI HSP, fraction == 1.0.
    full_hsp = float((g10["score"].to_numpy() >= 7.0).sum() / len(g10) * 100)
    em_all = computeEligibleMetrics(g10, anchorScore=7.0, eligibleMask=None, scoreCol="score")
    assert abs(em_all["eligible_hit_score_pct"] - full_hsp) < 1e-12, (em_all, full_hsp)
    assert em_all["eligible_area_fraction"] == 1.0, em_all

    # None anchor score / no eligible cells -> eligible HSP is None, not 0/100.
    assert computeEligibleMetrics(g10, None, elig10)["eligible_hit_score_pct"] is None
    assert computeEligibleMetrics(g10, 7.0, np.zeros(10, dtype=bool))["eligible_hit_score_pct"] is None

    # AREA, not cell count: widths 0.08 / 0.01 / 0.01 deg at one latitude.
    # Eligible = the two SMALL cells: count fraction 2/3, AREA fraction 0.2.
    gArea = gpd.GeoDataFrame(
        {"score": [1.0, 2.0, 3.0]},
        geometry=[box(12.00, 45.0, 12.08, 45.01),
                  box(12.08, 45.0, 12.09, 45.01),
                  box(12.09, 45.0, 12.10, 45.01)],
        crs="EPSG:4326",
    )
    emA = computeEligibleMetrics(gArea, anchorScore=None, eligibleMask=np.array([False, True, True]))
    assert emA["eligible_cells"] == 2, emA
    assert abs(emA["eligible_area_fraction"] - 0.2) < 2e-2, emA        # ~0.2, NOT 2/3
    assert emA["eligible_area_fraction"] < 0.35, emA                   # a count ratio (0.667) would fail
    print("OK: eligible-domain HSP is tie-safe and eligible-area fraction is area-based")

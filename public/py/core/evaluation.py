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
    if not contained.empty:
        centDists = contained.geometry.centroid.distance(metricAnchor)
        nearestIdx = centDists.idxmin()
        distance = 0.0
    else:
        distances = metricGdf.geometry.centroid.distance(metricAnchor)
        nearestIdx = distances.idxmin()
        distance = float(np.float64(distances.loc[nearestIdx]))  # type: ignore

    anchorScore = float(np.float64(gridGdf.loc[nearestIdx, scoreCol]))  # type: ignore
    anchorRank = int(np.int64(gridGdf.loc[nearestIdx, "rank"]))  # type: ignore
    topIdx = gridGdf["rank"].idxmin()
    homeGuessDistance = float(metricGdf.geometry.centroid.loc[topIdx].distance(metricAnchor))  # type: ignore
    # HSP = fraction of cells with score >= anchor (paper definition, avoids rank tie-break bias)
    hsp = float((gridGdf[scoreCol] >= anchorScore).sum() / len(gridGdf) * 100)

    return {
        "anchor_rank": anchorRank,
        "n_cells": len(gridGdf),
        "hit_score_pct": float(hsp),
        "anchor_score": anchorScore,
        "distance_to_nearest_cell_m": distance,
        "home_guess_distance_m": homeGuessDistance
    }


def computeSearchArea(gridGdf: gpd.GeoDataFrame, anchorScore: float, scoreCol: str = "score") -> dict:
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

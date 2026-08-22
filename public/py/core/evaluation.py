import numpy as np
import geopandas as gpd
from shapely.geometry import Point


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

    # Reproject to metric CRS for distance measurements if input is geographic
    if gridGdf.crs and gridGdf.crs.is_geographic:
        metricCrs = gridGdf.estimate_utm_crs()
        metricGdf = gridGdf.to_crs(metricCrs)
        metricAnchor = gpd.GeoDataFrame(geometry=[anchorPoint], crs=gridGdf.crs).to_crs(metricCrs).geometry.iloc[0]
    else:
        metricGdf = gridGdf
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
    areaCells = priorityCells
    if areaCells.crs and areaCells.crs.is_geographic:
        areaCells = areaCells.to_crs(areaCells.estimate_utm_crs())
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

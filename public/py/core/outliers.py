import numpy as np
import geopandas as gpd
from typing import Tuple


def removeOutliers(
    gdf: gpd.GeoDataFrame,
    thresholdMultiplier: float = 2.0
) -> Tuple[gpd.GeoDataFrame, dict]:
    """
    Removes spatial outliers from a GeoDataFrame of crime locations.

    Outliers are defined as points whose Euclidean distance from the
    mean center exceeds the threshold:

        threshold = μ + thresholdMultiplier * σ

    The default thresholdMultiplier is 2.0, which corresponds to the
    original HubDist method used in the toolkit.

    Parameters:
        gdf                  : GeoDataFrame of crime point geometries
        thresholdMultiplier  : multiplier applied to the standard deviation.
                               Default = 2.0.

    Returns:
        Tuple of (filtered GeoDataFrame, stats dict)
    """

    if thresholdMultiplier <= 0:
        raise ValueError("thresholdMultiplier must be greater than 0.")

    if len(gdf) < 2:
        raise ValueError("At least 2 crime locations are required for outlier removal.")

    originalCrs = gdf.crs
    originalXy = [(float(g.x), float(g.y)) for g in gdf.geometry]

    # Hub distances must be in meters; reproject to metric CRS if needed
    if gdf.crs and gdf.crs.is_geographic:
        gdf = gdf.to_crs(gdf.estimate_utm_crs())

    meanX = gdf.geometry.x.mean()
    meanY = gdf.geometry.y.mean()

    hubDist = np.sqrt((gdf.geometry.x - meanX) ** 2 + (gdf.geometry.y - meanY) ** 2)

    mu = hubDist.mean()
    sigma = hubDist.std(ddof=0)  # population std — matches QGIS/paper convention
    threshold = mu + thresholdMultiplier * sigma

    mask = hubDist <= threshold

    filtered = gdf[mask].copy()
    filtered.reset_index(drop=True, inplace=True)

    # Return in the original CRS so the caller's pipeline is unaffected
    if originalCrs and filtered.crs != originalCrs:
        filtered = filtered.to_crs(originalCrs)

    perCrime = [
        {
            "seq": i + 1,
            "x": originalXy[i][0],
            "y": originalXy[i][1],
            "hub_dist_m": float(hubDist.iloc[i]),
            "flagged": bool(not mask.iloc[i]),
        }
        for i in range(len(hubDist))
    ]

    stats = {
        "n_original": len(gdf),
        "n_removed": int((~mask).sum()),
        "n_kept": len(filtered),
        "mu": float(mu),
        "sigma": float(sigma),
        "threshold_multiplier": float(thresholdMultiplier),
        "threshold": float(threshold),
        "per_crime": perCrime,
    }

    return filtered, stats

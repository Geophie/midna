import math
import geopandas as gpd

def rossmoLoop(gridGdf: gpd.GeoDataFrame, crimesXy, B: float, f: float, g: float, k: float = 1.0) -> gpd.GeoDataFrame:
    """
    Computes Rossmo's CGT probability surface.

    Parameters:
        gridGdf    : GeoDataFrame of grid cells with geometry
        crimesXy   : numpy array of shape (T, 2) with crime coordinates (x, y)
        f          : distance decay exponent outside the buffer zone
        g          : distance decay exponent inside the buffer zone
        B          : buffer zone radius
        k          : normalization constant (default 1.0)

    Returns:
        GeoDataFrame with an added 'score' column containing the Rossmo probability values
    """
    centroids = [(geom.centroid.x, geom.centroid.y) for geom in gridGdf.geometry]

    rossmoValues = []
    for c in centroids:
        dManhattan = []
        for crime in crimesXy:
            d = max(abs(c[0] - crime[0]) + abs(c[1] - crime[1]), 1e-9)
            dManhattan.append(d)

        phiValues = [1 if d > B else 0 for d in dManhattan]
        term1Values = [phi / math.pow(d, f) for phi, d in zip(phiValues, dManhattan)]
        term2Values = [(1-phi) * math.pow(B, g-f) / math.pow(max(2*B-d, 1e-9), g) for phi, d in zip(phiValues, dManhattan)]

        p = k * sum(term1Values + term2Values)
        rossmoValues.append(p)

    result = gridGdf.copy()
    result["score"] = rossmoValues
    return result

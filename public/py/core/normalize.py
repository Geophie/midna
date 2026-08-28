import geopandas as gpd

def normalizeScores(gridGdf: gpd.GeoDataFrame, col: str = "score") -> gpd.GeoDataFrame:

    """
    Normalizes a score column to the range [0, 100] using max-only scaling,
    matching the scientific comparison script:

        normalized = score / max(score) * 100

    The minimum is NOT subtracted, so a raw minimum > 0 stays > 0. The *100
    factor only preserves MIDNA's [0, 100] UI scale.

    Parameters:
        gridGdf : GeoDataFrame with a score column
        col     : name of the column to normalize (default 'score')

    Returns:
        GeoDataFrame with the specified column normalized to [0, 100]
    """

    import numpy as np
    result = gridGdf.copy()
    values = result[col].astype(float)
    if not np.isfinite(values).all():
        values = values.where(np.isfinite(values), other=0.0)
        result[col] = values
    vmax = values.max()
    if vmax <= 0:
        result[col] = 0.0
    else:
        result[col] = values / vmax * 100
    return result

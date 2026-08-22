import geopandas as gpd

def normalizeScores(gridGdf: gpd.GeoDataFrame, col: str = "score") -> gpd.GeoDataFrame:

    """
    Normalizes a score column to the range [0, 100] using min-max scaling.

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
    vmin, vmax = values.min(), values.max()
    if vmax == vmin:
        result[col] = 0.0
    else:
        result[col] = (values - vmin) / (vmax - vmin) * 100
    return result

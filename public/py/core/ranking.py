import geopandas as gpd
import numpy as np

def rankCells(gridGdf: gpd.GeoDataFrame, col: str = "score") -> gpd.GeoDataFrame:
    """
    Sorts grid cells by score in descending order and assigns a rank.

    Parameters:
        gridGdf : GeoDataFrame with a score column
        col     : name of the column to rank by (default 'score')

    Returns:
        GeoDataFrame sorted by score with an added 'rank' column (1 = highest score)
    """
    result = gridGdf.copy()

    result = result.sort_values(by=col, ascending=False)
    result = result.reset_index(drop=True)
    scores = result[col].to_numpy(dtype=float)
    if np.isfinite(scores).all():
        result["rank"] = result[col].rank(method="min", ascending=False).astype(int)
    else:
        # Preserve the existing sequential behavior for pathological score
        # inputs; tied-score semantics apply only to finite Rossmo surfaces.
        result["rank"] = range(1, len(result) + 1)

    return result

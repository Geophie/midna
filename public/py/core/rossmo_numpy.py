import numpy as np
import geopandas as gpd

def rossmoNumpy(gridGdf: gpd.GeoDataFrame, crimesXy: np.ndarray, B: float, f: float, g: float, k: float = 1.0) -> gpd.GeoDataFrame:
    """
    Computes Rossmo's CGT probability surface using a vectorized numpy implementation.

    Faster than rossmoLoop for large grids — all distances and scores
    are computed in a single matrix operation instead of nested loops.

    Parameters:
        gridGdf    : GeoDataFrame of grid cells with geometry
        crimesXy   : numpy array of shape (T, 2) with crime coordinates (x, y)
        B          : buffer zone radius
        f          : distance decay exponent outside the buffer zone
        g          : distance decay exponent inside the buffer zone
        k          : normalization constant (default 1.0)

    Returns:
        GeoDataFrame with an added 'score' column containing the Rossmo probability values
    """

    n_cells, n_crimes = len(gridGdf), len(crimesXy)
    estimated_bytes = n_cells * n_crimes * 8 * 8
    max_bytes = 4_000_000_000
    if estimated_bytes > max_bytes:
        raise MemoryError(
            f"Grid too large for the numpy engine: {n_cells} cells x {n_crimes} crimes "
            f"would need an estimated {estimated_bytes / 1e9:.1f} GB of memory. "
            f"Reduce the grid resolution or switch to the 'loop' engine."
        )

    centroids = np.array([(geom.centroid.x, geom.centroid.y) for geom in gridGdf.geometry])

    diff = np.abs(centroids[:, None, :] - crimesXy[None, :, :])

    distances = diff.sum(axis=2)
    distances = np.where(distances == 0, 1e-9, distances)

    phi = np.where(distances > B, 1.0, 0.0)

    term1 = phi / np.power(distances, f)

    innerDenom = np.maximum(2.0 * B - distances, 1e-9)
    term2 = (1.0 - phi) * (B ** (g - f)) / np.power(innerDenom, g)

    scores = k * (term1 + term2).sum(axis=1)

    result = gridGdf.copy()
    result["score"] = scores

    return result


if __name__ == "__main__":
    from shapely.geometry import Point

    small_grid = gpd.GeoDataFrame(geometry=[Point(x, y) for x in range(3) for y in range(3)])
    small_crimes = np.array([[0.5, 0.5], [2.0, 2.0]])
    out = rossmoNumpy(small_grid, small_crimes, B=1.0, f=2.0, g=4.0)
    assert "score" in out.columns and len(out) == 9 and (out["score"] > 0).all()
    print("OK: normal-sized grid computes scores without tripping the memory guard")

    class _FakeSizedGrid:
        def __len__(self) -> int:
            return 10_000_000  # e.g. a runaway grid resolution

    huge_crimes = np.zeros((1000, 2))  # a realistic crime count, cheap to allocate
    try:
        rossmoNumpy(_FakeSizedGrid(), huge_crimes, B=1.0, f=2.0, g=4.0)
        raise AssertionError("expected MemoryError for oversized grid, none raised")
    except MemoryError as e:
        assert "too large" in str(e)
        print("OK: oversized grid raises a clean, catchable MemoryError before allocating")

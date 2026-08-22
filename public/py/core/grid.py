import geopandas as gpd
from shapely.geometry import box

def createGrid(aoiGdf: gpd.GeoDataFrame, numCellsX: int = 200, numCellsY: int = 200) -> gpd.GeoDataFrame:

    """
    Creates a regular grid of cells over the Area of Interest bounds.

    The grid always contains numCellsX * numCellsY cells.
    Each cell is assigned a unique cell_id for use in downstream pipeline steps.

    Parameters:
        aoiGdf     : GeoDataFrame representing the Area of Interest polygon
        numCellsX  : number of columns in the grid (default 200)
        numCellsY  : number of rows in the grid (default 200)

    Returns:
        GeoDataFrame of grid cells, with a cell_id column
    """
    if numCellsX <= 0 or numCellsY <= 0:
        raise ValueError("numCellsX and numCellsY must be positive integers.")

    xmin, ymin, xmax, ymax = aoiGdf.total_bounds

    if xmax == xmin or ymax == ymin:
        raise ValueError(
            "The AOI has zero width or height — cannot create a grid. "
            "Check that your crime data has distinct locations and a valid CRS."
        )

    xStep = (xmax - xmin) / numCellsX
    yStep = (ymax - ymin) / numCellsY

    gridCells = []
    for i in range(numCellsY):
        for j in range(numCellsX):

            cellXmin = xmin + j * xStep
            cellXmax = xmin + (j + 1) * xStep
            cellYmin = ymin + i * yStep
            cellYmax = ymin + (i + 1) * yStep


            cellPolygon = box(cellXmin, cellYmin, cellXmax, cellYmax)
            gridCells.append(cellPolygon)

    gridGdf = gpd.GeoDataFrame(geometry=gridCells, crs=aoiGdf.crs)
    gridGdf["cell_id"] = range(len(gridGdf))

    return gridGdf


def computeLonlat(gdf: gpd.GeoDataFrame):
    """Returns (longitude, latitude) arrays in EPSG:4326 for each geometry's centroid."""
    # Centroid must be computed in a metric CRS — doing it directly in degrees
    # distorts the result (geopandas warns about this).
    if gdf.crs and gdf.crs.is_geographic:
        metricCrs = gdf.estimate_utm_crs()
        centroids = gdf.geometry.to_crs(metricCrs).centroid.to_crs("EPSG:4326")
    else:
        centroids = gdf.geometry.centroid.to_crs("EPSG:4326")
    return centroids.x.to_numpy(), centroids.y.to_numpy()


_lonlatAliases = [
    ("longitude", "latitude"), ("lon", "lat"), ("lng", "lat"), ("long", "lat"),
    ("x", "y"), ("point_x", "point_y"),
]


def findLonlatColumns(gdf: gpd.GeoDataFrame):
    """Case-insensitive lookup of a known lon/lat column-name pair. None if absent."""
    lower = {c.lower(): c for c in gdf.columns}
    for lonKey, latKey in _lonlatAliases:
        if lonKey in lower and latKey in lower:
            return lower[lonKey], lower[latKey]
    return None


def resolveLonlat(gdf: gpd.GeoDataFrame):
    """
    Returns (longitude, latitude, message) in EPSG:4326 for each cell.

    Prefers an existing lon/lat-like column pair, but only if every value actually
    falls inside its own cell polygon (checked in EPSG:4326) — otherwise falls back
    to the computed centroid. This also makes it safe to treat generic 'X'/'Y'
    columns as candidates: if they turn out to be projected easting/northing rather
    than degrees, the containment check rejects them automatically.
    """
    lonC, latC = computeLonlat(gdf)
    found = findLonlatColumns(gdf)
    if found is None:
        return lonC, latC, "computed from cell centroid (no existing lon/lat column found)"

    lonCol, latCol = found
    gdf4326 = gdf.to_crs("EPSG:4326") if gdf.crs != "EPSG:4326" else gdf
    pts = gpd.GeoSeries(gpd.points_from_xy(gdf[lonCol], gdf[latCol]), crs="EPSG:4326")
    covers = gdf4326.geometry.reset_index(drop=True).covers(pts.reset_index(drop=True)).to_numpy()

    if covers.all():
        return (gdf[lonCol].to_numpy(dtype=float), gdf[latCol].to_numpy(dtype=float),
                f"reused existing '{lonCol}'/'{latCol}' columns (verified against cell geometry)")
    return (lonC, latC,
            f"existing '{lonCol}'/'{latCol}' columns ignored — {int((~covers).sum())} cell(s) "
            f"don't fall inside their own geometry; using computed centroid instead")


def toPointLayer(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """
    Copy of gdf with polygon geometry replaced by a Point built from its own
    Longitude/Latitude columns (EPSG:4326) — for QGIS Heatmap symbology, which
    only works on point layers.
    """
    pts = gdf.drop(columns="geometry")
    return gpd.GeoDataFrame(pts, geometry=gpd.points_from_xy(gdf["Longitude"], gdf["Latitude"]), crs="EPSG:4326")

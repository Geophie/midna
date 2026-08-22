import numpy as np
import pandas as pd
import geopandas as gpd
from shapely.geometry import box


def loadCrimesCsv(csvPath: str, latCol: str = "Latitude", lonCol: str = "Longitude") -> pd.DataFrame:
    """
    Loads the crime CSV file and returns a DataFrame.

    This function centralizes CSV reading so the rest of the pipeline always works with an already-loaded DataFrame.
    """

    df = pd.read_csv(csvPath)

    if latCol not in df.columns or lonCol not in df.columns:
        raise ValueError(f"Columns '{latCol}' and/or '{lonCol}' not found in {csvPath}.")

    if df.empty:
        raise ValueError(f"The crimes file '{csvPath}' is empty.")

    for col in [latCol, lonCol]:
        if not pd.api.types.is_numeric_dtype(df[col]):
            raise ValueError(f"Column '{col}' must contain numeric values.")
        if df[col].isnull().any():
            raise ValueError(f"Column '{col}' contains missing (NaN) values.")
        if np.isinf(df[col]).any():
            raise ValueError(f"Column '{col}' contains infinite values.")

    return df


def computeAoiFromGdf(gdf: gpd.GeoDataFrame, bufferPct: float = 0.1) -> gpd.GeoDataFrame:
    """
    Computes the Area of Interest as a buffered bounding box around a GeoDataFrame.
    Works in whatever CRS the GeoDataFrame already uses.
    """
    if gdf.empty:
        raise ValueError("Cannot compute AOI from an empty GeoDataFrame.")

    xmin, ymin, xmax, ymax = gdf.total_bounds
    w = xmax - xmin
    h = ymax - ymin
    bbox = box(
        xmin - w * bufferPct,
        ymin - h * bufferPct,
        xmax + w * bufferPct,
        ymax + h * bufferPct,
    )
    return gpd.GeoDataFrame(geometry=[bbox], crs=gdf.crs)


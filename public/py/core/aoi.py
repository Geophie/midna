import numpy as np
import pandas as pd
import geopandas as gpd
from shapely.geometry import box


def resolveCsvColumnNames(columns, latCol: str, lonCol: str) -> tuple[str, str]:
    """Resolve configured coordinate names without renaming DataFrame columns."""
    def resolve(requested: str) -> str:
        matches = [column for column in columns if str(column).casefold() == requested.casefold()]
        if len(matches) > 1:
            names = ", ".join(repr(column) for column in matches)
            raise ValueError(
                f"CSV coordinate column '{requested}' is ambiguous: case-insensitive matches {names}."
            )
        return matches[0] if matches else requested

    return resolve(latCol), resolve(lonCol)


def loadCrimesCsv(csvPath: str, latCol: str = "Latitude", lonCol: str = "Longitude") -> pd.DataFrame:
    """
    Loads the crime CSV file and returns a DataFrame.

    This function centralizes CSV reading so the rest of the pipeline always works with an already-loaded DataFrame.
    """

    df = pd.read_csv(csvPath)

    resolvedLatCol, resolvedLonCol = resolveCsvColumnNames(df.columns, latCol, lonCol)
    if resolvedLatCol not in df.columns or resolvedLonCol not in df.columns:
        raise ValueError(f"Columns '{latCol}' and/or '{lonCol}' not found in {csvPath}.")

    if df.empty:
        raise ValueError(f"The crimes file '{csvPath}' is empty.")

    for col in [resolvedLatCol, resolvedLonCol]:
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

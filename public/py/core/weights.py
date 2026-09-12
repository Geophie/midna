import numpy as np
import geopandas as gpd
from pathlib import Path
from typing import Optional, Sequence, Tuple

# An optional DEM elevation band below Plain or above Mountain: a
# (threshold, weight) pair using the same minimum-elevation convention as
# the three core classes. See _classifyDemValues.
DemBand = Tuple[float, float]


def _classifyDemValues(
    demValues: np.ndarray,
    pianuraMin: float = 0.0,
    collinaMin: float = 250.0,
    montagnaMin: float = 350.0,
    lowWeight: float = 0.4,
    midWeight: float = 0.8,
    highWeight: float = 0.0,
    nodataWeight: float = 0.0,
    lowerBands: Optional[Sequence[DemBand]] = None,
    upperBands: Optional[Sequence[DemBand]] = None,
) -> np.ndarray:

    # Full minimum-elevation sequence: optional bands below Plain, the three
    # core classes (Plain/Hillside/Mountain), optional bands above Mountain.
    # Callers (pipeline.py, and ultimately src/lib/validateEnvWeights.ts on
    # the browser side) are responsible for strict ascending order across
    # the whole sequence — this function only classifies, it does not
    # validate or sort.
    bands: list[DemBand] = (
        list(lowerBands or [])
        + [(pianuraMin, lowWeight), (collinaMin, midWeight), (montagnaMin, highWeight)]
        + list(upperBands or [])
    )
    thresholds = np.array([t for t, _ in bands], dtype=float)
    bandWeights = np.array([w for _, w in bands], dtype=float)

    # Cells below the lowest configured threshold (and NaN) keep the nodata weight.
    weights = np.full(len(demValues), nodataWeight, dtype=float)
    valid = ~np.isnan(demValues)
    validValues = demValues[valid]

    # threshold_i <= elevation < threshold_(i+1), and elevation >= highest
    # threshold falls in the last (highest) band — searchsorted(side="right")
    # finds the rightmost threshold <= value in one vectorized pass; NaN is
    # excluded above so it never reaches the search.
    idx = np.searchsorted(thresholds, validValues, side="right") - 1
    inRange = idx >= 0
    validWeights = np.full(len(validValues), nodataWeight, dtype=float)
    validWeights[inRange] = bandWeights[idx[inRange]]
    weights[valid] = validWeights

    return weights


def clipDemToAoi(demPath: str, aoiGdf: gpd.GeoDataFrame, outputPath: Optional[str] = None) -> str:

    """
    Clips a raster DEM to the Area of Interest and writes the clipped raster.

    Parameters:
        demPath    : path to the full DEM raster
        aoiGdf     : Area of Interest GeoDataFrame
        outputPath : optional path for the clipped DEM (default: unique temp file)

    Returns:
        Path to the clipped DEM raster
    """

    import rasterio
    from rasterio.mask import mask
    import tempfile

    if outputPath is None:
        suffix = Path(demPath).suffix or ".tif"
        tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
        tmp.close()
        outputPath = tmp.name

    with rasterio.open(demPath) as src:
        aoiForDem = aoiGdf.to_crs(src.crs) if src.crs else aoiGdf
        geometries = [geom for geom in aoiForDem.geometry if geom is not None and not geom.is_empty]

        if not geometries:
            raise ValueError("AOI contains no valid geometries — cannot clip DEM.")

        clippedImage, clippedTransform = mask(src, geometries, crop=True)
        clippedMeta = src.meta.copy()
        clippedMeta.update({
            "height": clippedImage.shape[1],
            "width": clippedImage.shape[2],
            "transform": clippedTransform
        })

    with rasterio.open(outputPath, "w", **clippedMeta) as dst:
        dst.write(clippedImage)

    return outputPath


def computeDemCellMeans(gridGdf: gpd.GeoDataFrame, demPath: str) -> np.ndarray:

    """
    Computes mean elevation for each grid cell intersecting a DEM raster.
    """

    import rasterio
    from rasterio.mask import mask

    means = []

    with rasterio.open(demPath) as src:
        gridForDem = gridGdf.to_crs(src.crs) if src.crs else gridGdf

        for geom in gridForDem.geometry:
            try:
                outImage, _ = mask(src, [geom], crop=True, filled=False)
                band = outImage[0]
                values = band.compressed() if np.ma.is_masked(band) else band.reshape(-1)

                if src.nodata is not None:
                    values = values[values != src.nodata]

                if len(values) == 0:
                    means.append(np.nan)
                else:
                    means.append(float(np.mean(values)))

            except ValueError:
                means.append(np.nan)

    return np.array(means, dtype=float)


def applyDemWeights(
    gridGdf: gpd.GeoDataFrame,
    demValues: np.ndarray,
    pianuraMin: float = 0.0,
    collinaMin: float = 250.0,
    montagnaMin: float = 350.0,
    lowWeight: float = 0.4,
    midWeight: float = 0.8,
    highWeight: float = 0.0,
    nodataWeight: float = 0.0,
    lowerBands: Optional[Sequence[DemBand]] = None,
    upperBands: Optional[Sequence[DemBand]] = None,
) -> gpd.GeoDataFrame:

    """
    Assigns elevation-based weights to grid cells using DEM values.

    Weight classes (minimum-elevation thresholds):
        elevation < pianuraMin              : w = nodata weight
        pianuraMin <= elevation < collinaMin (0 <= elevation < 250m) : w = 0.4 (flatland)
        collinaMin <= elevation < montagnaMin (250 <= elevation < 350m) : w = 0.8 (hillside)
        montagnaMin <= elevation (>=350m) : w = 0.0 (mountain)

    lowerBands / upperBands optionally extend this with extra DEM elevation
    bands below Plain and above Mountain, each a (threshold, weight) pair.
    With none supplied (the default), behaviour is identical to the three
    core classes above. See _classifyDemValues for the full ordering
    contract.

    Parameters:
        gridGdf   : GeoDataFrame of grid cells
        demValues : numpy array of elevation values, one per cell

    Returns:
        GeoDataFrame with added 'w_dem' column
    """

    if len(demValues) != len(gridGdf):
        raise ValueError(
            f"demValues length ({len(demValues)}) does not match gridGdf length ({len(gridGdf)})."
        )

    weights = _classifyDemValues(
        demValues,
        pianuraMin=pianuraMin,
        collinaMin=collinaMin,
        montagnaMin=montagnaMin,
        lowWeight=lowWeight,
        midWeight=midWeight,
        highWeight=highWeight,
        nodataWeight=nodataWeight,
        lowerBands=lowerBands,
        upperBands=upperBands,
    )

    result = gridGdf.copy()
    result["dem_mean"] = demValues
    result["w_dem"] = weights

    return result


def applyIntersectionLayer(
    gridGdf: gpd.GeoDataFrame,
    layerGdf: gpd.GeoDataFrame,
    colName: str,
    intersectWeight: float,
    noIntersectWeight: float
) -> gpd.GeoDataFrame:

    """
    Assigns weights according to presence or absence of intersection with a vector layer.
    """

    if layerGdf.crs != gridGdf.crs:
        layerGdf = layerGdf.to_crs(gridGdf.crs)
    joined = gpd.sjoin(gridGdf, layerGdf[["geometry"]], predicate="intersects", how="left")
    intersectingIndices = joined.index[joined["index_right"].notna()].unique()

    result = gridGdf.copy()
    result[colName] = noIntersectWeight
    result.loc[intersectingIndices, colName] = intersectWeight

    return result


def applyInclusionLayer(
    gridGdf: gpd.GeoDataFrame,
    layerGdf: gpd.GeoDataFrame,
    colName: str,
    intersectWeight: float = 1.0,
    noIntersectWeight: float = 0.0
) -> gpd.GeoDataFrame:

    """
    Applies an inclusion layer to grid cells.

    Cells intersecting the inclusion layer receive w=1 (e.g. residential neighborhoods).
    All other cells receive w=0.

    Parameters:
        gridGdf   : GeoDataFrame of grid cells
        layerGdf  : GeoDataFrame of the inclusion layer polygons
        colName   : name of the weight column to add (e.g. 'w_neighborhoods')

    Returns:
        GeoDataFrame with added weight column
    """

    return applyIntersectionLayer(
        gridGdf,
        layerGdf,
        colName,
        intersectWeight=intersectWeight,
        noIntersectWeight=noIntersectWeight
    )



def applyExclusionLayer(
    gridGdf: gpd.GeoDataFrame,
    layerGdf: gpd.GeoDataFrame,
    colName: str,
    intersectWeight: float = 0.0,
    noIntersectWeight: float = 1.0
) -> gpd.GeoDataFrame:

    """
    Applies a hard exclusion layer to grid cells.

    Cells intersecting the exclusion layer receive w=0 (e.g. parks, cemeteries).
    All other cells receive w=1.

    Parameters:
        gridGdf   : GeoDataFrame of grid cells
        layerGdf  : GeoDataFrame of the exclusion layer polygons
        colName   : name of the weight column to add (e.g. 'w_parks')

    Returns:
        GeoDataFrame with added weight column
    """

    return applyIntersectionLayer(
        gridGdf,
        layerGdf,
        colName,
        intersectWeight=intersectWeight,
        noIntersectWeight=noIntersectWeight
    )


def applyWeights(gridGdf: gpd.GeoDataFrame, weightColumns: list) -> gpd.GeoDataFrame:

    """
    Multiplies the Rossmo score by all specified weight columns.

    Each weight column is applied sequentially, producing a refined
    probability surface that incorporates environmental constraints.

    Parameters:
        gridGdf       : GeoDataFrame with a 'score' column
        weightColumns : list of column names to multiply (e.g. ['w_dem', 'w_parks'])

    Returns:
        GeoDataFrame with added 'score_enhanced' column
    """

    result = gridGdf.copy()
    result["score_enhanced"] = result["score"]

    for col in weightColumns:
        result["score_enhanced"] = result["score_enhanced"] * result[col]

    return result


if __name__ == "__main__":
    # Self-check for the current default minimum-threshold DEM binning.
    _vals = np.array([-10.0, 0.0, 100.0, 249.999, 250.0, 300.0, 350.0, 500.0, np.nan])
    _w = _classifyDemValues(
        _vals, pianuraMin=0.0, montagnaMin=350.0,
        lowWeight=0.4, midWeight=0.8, highWeight=0.0, nodataWeight=-1.0,
    )
    # below pianuraMin and NaN -> nodata; [0,250) -> low; [250,350) -> mid; >=350 -> high
    assert list(_w) == [-1.0, 0.4, 0.4, 0.4, 0.8, 0.8, 0.0, 0.0, -1.0], list(_w)

    # Same defaults, no extra bands passed at all -> numerically identical
    # (backward compatibility: lowerBands/upperBands default to None).
    _w_default_call = _classifyDemValues(
        _vals, pianuraMin=0.0, montagnaMin=350.0,
        lowWeight=0.4, midWeight=0.8, highWeight=0.0, nodataWeight=-1.0,
        lowerBands=None, upperBands=None,
    )
    assert list(_w_default_call) == list(_w), list(_w_default_call)

    # Optional lower/upper bands: -200 < -50 < 0 < 250 < 350 < 700 < 1200.
    _vals_extra = np.array([
        -201.0, -200.0, -199.999, -50.0, -49.999, 0.0, 249.999, 250.0,
        349.999, 350.0, 699.999, 700.0, 1199.999, 1200.0, 2000.0, np.nan,
    ])
    _w_extra = _classifyDemValues(
        _vals_extra, pianuraMin=0.0, collinaMin=250.0, montagnaMin=350.0,
        lowWeight=0.4, midWeight=0.8, highWeight=0.5, nodataWeight=-1.0,
        lowerBands=[(-200.0, 0.2), (-50.0, 0.3)],
        upperBands=[(700.0, 0.2), (1200.0, 0.1)],
    )
    assert list(_w_extra) == [
        -1.0, 0.2, 0.2, 0.3, 0.3, 0.4, 0.4, 0.8,
        0.8, 0.5, 0.5, 0.2, 0.2, 0.1, 0.1, -1.0,
    ], list(_w_extra)

    print("weights self-check OK")

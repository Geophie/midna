import numpy as np

def computeBufferZone(crimesXy: np.ndarray) -> float:
    """
    Computes the buffer zone radius B using the formula from Rossmo (2000):

        B = (1 / 2T) * sum of minimum Manhattan distances between crime locations

    Parameters:
        crimesXy : numpy array of shape (T, 2) with crime coordinates (x, y)

    Returns:
        B as a float
    """

    T = len(crimesXy)
    if T < 2:
        raise ValueError("At least 2 crime locations are required to compute B automatically.")

    diff = np.abs(crimesXy[:, None] - crimesXy[None, :])
    distMatrix = diff.sum(axis=2)
    np.fill_diagonal(distMatrix, np.inf)
    minDistances = distMatrix.min(axis=1)

    B = minDistances.sum() / (2 * T)

    if B == 0:
        raise ValueError("All crime locations are identical — cannot compute a meaningful buffer zone B.")

    return B

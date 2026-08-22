import numpy as np

def computeGini(score: np.ndarray) -> float:
    """
    Computes the Gini coefficient for a distribution of CGT scores.

    A higher Gini value indicates stronger concentration of probability
    mass within a smaller subset of grid cells (better model focus).

    Parameters:
        score : numpy array of CGT score values

    Returns:
        Gini coefficient as a float between 0 and 1
    """

    score = np.asarray(score, dtype=float)
    score = score[np.isfinite(score)]
    sortedArr = np.sort(score)
    n = len(sortedArr)
    total = sortedArr.sum()
    if total == 0 or n == 0:
        return 0.0
    index = np.arange(1, n + 1)
    gini = float(np.sum((2 * index - n - 1) * sortedArr) / (n * total))
    return gini

def computeLorenz(scores: np.ndarray) -> tuple:
    """
    Computes the Lorenz curve for a distribution of CGT scores.

    Parameters:
        scores : numpy array of CGT score values

    Returns:
        Tuple of (x, y) arrays representing the Lorenz curve,
        where x is the cumulative proportion of observations
        and y is the cumulative proportion of values
    """

    scores = np.asarray(scores, dtype=float)
    scores = scores[np.isfinite(scores)]
    if len(scores) == 0 or scores.sum() == 0:
        return np.array([0.0, 1.0]), np.array([0.0, 1.0])
    sortedArr = np.sort(scores)
    weightedSum = sortedArr.cumsum() / sortedArr.sum()
    lorenzY = np.insert(weightedSum, 0, 0)
    lorenzX = np.linspace(0, 1, len(lorenzY))
    return lorenzX, lorenzY


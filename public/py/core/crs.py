from pyproj import CRS
from pyproj.exceptions import CRSError


def inspect_analysis_crs(value: str) -> dict:
    """Return semantic CRS metadata for advisory UI use only."""
    try:
        crs = CRS.from_user_input(value)
    except (CRSError, TypeError, ValueError):
        return {"valid": False, "is_geographic": False}
    return {"valid": True, "is_geographic": bool(crs.is_geographic)}

import proj4 from "proj4";

/**
 * Client-side coordinate reprojection for the map preview only.
 *
 * The Rossmo analysis itself is reprojected server-side by pyproj in the
 * worker (pipeline.py tags the crimes with `input_crs`, then `to_crs`s to the
 * analysis CRS), and results come back as EPSG:4326. This module exists purely
 * so the *raw crime / anchor markers* drawn straight from the uploaded CSV land
 * in the right place when that CSV is not already WGS84 lon/lat.
 *
 * proj4 only ships definitions for EPSG:4326 / 4269 / 3857. Everything else has
 * to be registered. UTM is formulaic, so those are generated; a short curated
 * list covers the common non-UTM cases. Unknown codes resolve to `null` and the
 * caller drops the point rather than mispinning it.
 *
 * Datum shifts use proj4's 7-parameter Helmert (no NADCON/NTv2 grids), which is
 * off by up to a few tens of metres for NAD27 — invisible at map-preview scale,
 * and the real analysis uses the accurate pyproj transform anyway.
 */

// --- generated UTM definitions ------------------------------------------------
for (let zone = 1; zone <= 60; zone += 1) {
  const zz = String(zone).padStart(2, "0");
  proj4.defs(`EPSG:326${zz}`, `+proj=utm +zone=${zone} +datum=WGS84 +units=m +no_defs`);
  proj4.defs(`EPSG:327${zz}`, `+proj=utm +zone=${zone} +south +datum=WGS84 +units=m +no_defs`);
  proj4.defs(
    `EPSG:322${zz}`,
    `+proj=utm +zone=${zone} +ellps=WGS72 +towgs84=0,0,4.5,0,0,0.554,0.2 +units=m +no_defs`
  );
  proj4.defs(
    `EPSG:323${zz}`,
    `+proj=utm +zone=${zone} +south +ellps=WGS72 +towgs84=0,0,4.5,0,0,0.554,0.2 +units=m +no_defs`
  );
}
for (let zone = 1; zone <= 23; zone += 1) {
  proj4.defs(
    `EPSG:269${String(zone).padStart(2, "0")}`,
    `+proj=utm +zone=${zone} +datum=NAD83 +units=m +no_defs`
  );
}

// --- curated non-UTM definitions (extend as needed) -------------------------
const STATIC_DEFS: Record<string, string> = {
  "EPSG:3857": "+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +no_defs",
  "EPSG:27700": "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=446.448,-125.157,542.06,0.15,0.247,0.842,-20.489 +units=m +no_defs",
  "EPSG:2154": "+proj=lcc +lat_1=49 +lat_2=44 +lat_0=46.5 +lon_0=3 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs",
  "EPSG:28992": "+proj=sterea +lat_0=52.1561605555556 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.417,50.3319,465.552,-0.398957,0.343988,-1.8774,4.0725 +units=m +no_defs",
  // Georgia State Plane (Atlanta is in the WEST zone: 26767 / 26967 / 2240).
  // The EAST-zone codes (26766 / 26966 / 2239) are kept for completeness.
  "EPSG:26766": "+proj=tmerc +lat_0=30 +lon_0=-82.1666666666667 +k=0.9999 +x_0=152400.3048006096 +y_0=0 +datum=NAD27 +units=us-ft +no_defs", // NAD27 / Georgia East (US ft)
  "EPSG:26767": "+proj=tmerc +lat_0=30 +lon_0=-84.1666666666667 +k=0.9999 +x_0=152400.3048006096 +y_0=0 +datum=NAD27 +units=us-ft +no_defs", // NAD27 / Georgia West (US ft)
  "EPSG:26966": "+proj=tmerc +lat_0=30 +lon_0=-82.1666666666667 +k=0.9999 +x_0=200000 +y_0=0 +datum=NAD83 +units=m +no_defs", // NAD83 / Georgia East (m)
  "EPSG:26967": "+proj=tmerc +lat_0=30 +lon_0=-84.1666666666667 +k=0.9999 +x_0=699999.9998983998 +y_0=0 +datum=NAD83 +units=m +no_defs", // NAD83 / Georgia West (m)
  "EPSG:2239": "+proj=tmerc +lat_0=30 +lon_0=-82.1666666666667 +k=0.9999 +x_0=200000.0001016 +y_0=0 +datum=NAD83 +units=us-ft +no_defs", // NAD83 / Georgia East (ftUS)
  "EPSG:2240": "+proj=tmerc +lat_0=30 +lon_0=-84.1666666666667 +k=0.9999 +x_0=699999.9998983998 +y_0=0 +datum=NAD83 +units=us-ft +no_defs", // NAD83 / Georgia West (ftUS)
};
for (const [code, def] of Object.entries(STATIC_DEFS)) {
  if (proj4.defs(code) === undefined) proj4.defs(code, def);
}

/**
 * "epsg:32616" | "EPSG: 32616" | "32616" | "urn:ogc:def:crs:EPSG::32616"
 *   -> "EPSG:32616".
 * "WGS84" | "CRS84" | "CRS:84" -> "EPSG:4326".
 * Anything unrecognizable -> null.
 */
export function normalizeEpsg(raw: string): string | null {
  const s = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (s === "") return null;
  if (s === "WGS84" || s === "WGS-84" || s === "CRS84" || s === "CRS:84" || s === "OGC:CRS84") {
    return "EPSG:4326";
  }
  const match = s.match(/(?:EPSG:{1,2}|URN:OGC:DEF:CRS:EPSG::)?(\d{4,6})$/);
  return match ? `EPSG:${match[1]}` : null;
}

/** True when `crs` is (or normalizes to) EPSG:4326 — the no-op fast path. */
export function isWgs84(crs: string): boolean {
  return normalizeEpsg(crs) === "EPSG:4326";
}

/** True when `crs` can actually be reprojected (built-in, generated, or curated). */
export function crsIsKnown(crs: string): boolean {
  const code = normalizeEpsg(crs);
  if (code === null) return false;
  if (code === "EPSG:4326") return true;
  return proj4.defs(code) !== undefined;
}

/**
 * (x, y) in `sourceCrs` -> [lon, lat] in WGS84 degrees, or null if the CRS is
 * unknown or the result is non-finite / outside valid lon-lat range.
 *
 * Axis convention matches pipeline.py's `points_from_xy(df[lon_col], df[lat_col])`:
 * x is the value from the configured longitude column, y from the latitude
 * column — even for a projected CRS where those column names are really
 * easting/northing.
 */
export function toWgs84(x: number, y: number, sourceCrs: string): [number, number] | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const code = normalizeEpsg(sourceCrs);
  if (code === null) return null;
  if (code === "EPSG:4326") return [x, y];
  if (proj4.defs(code) === undefined) return null;
  try {
    const [lon, lat] = proj4(code, "EPSG:4326", [x, y]) as [number, number];
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    return [lon, lat];
  } catch {
    return null;
  }
}

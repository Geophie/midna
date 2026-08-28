import { resolveCsvCoordinateColumns } from "@/lib/csvColumns";
import { normalizeEpsg, toWgs84 } from "@/lib/crsProject";

export interface LatLon {
  lat: number;
  lon: number;
}

function splitCsvLine(line: string): string[] {
  return line.split(",").map((cell) => cell.trim());
}

/**
 * `crs` is the CRS the CSV coordinates are stored in (params.inputCrs).
 * Defaults to EPSG:4326 so existing callers and WGS84 files are a no-op.
 * Rows that can't be reprojected (unknown CRS, out-of-range result) are
 * dropped rather than mispinned.
 */
function csvRowsToPoints(
  csvText: string,
  latCol: string,
  lonCol: string,
  crs = "EPSG:4326"
): LatLon[] {
  const lines = csvText.split(/\r\n|\r|\n/).filter((l) => l.length > 0);
  if (lines.length < 2) return [];

  const header = splitCsvLine(lines[0]);
  const columns = resolveCsvCoordinateColumns(header, latCol, lonCol);
  if ("error" in columns) return [];
  const { latIdx, lonIdx } = columns;

  const points: LatLon[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    // pipeline.py convention: lonCol -> x, latCol -> y (even for projected CRSs)
    const x = Number(cells[lonIdx]);
    const y = Number(cells[latIdx]);
    const wgs = toWgs84(x, y, crs);
    if (wgs) points.push({ lon: wgs[0], lat: wgs[1] });
  }
  return points;
}

/** One point per valid CSV row, in file order (for numbered markers). */
export function parseCrimePoints(
  csvText: string,
  latCol: string,
  lonCol: string,
  crs = "EPSG:4326"
): LatLon[] {
  return csvRowsToPoints(csvText, latCol, lonCol, crs);
}

/**
 * Matches pipeline.py's anchor convention: only the first row/geometry in
 * the file is used. File type is sniffed from its name (.csv vs
 * .geojson/.json), same as the anchor upload form itself.
 *
 * `crs` (params.inputCrs) applies to a CSV anchor. A GeoJSON anchor is WGS84
 * per RFC 7946 unless it carries a legacy top-level `crs` member, which is
 * honoured if present.
 */
export function parseAnchorPoint(
  fileName: string,
  bytes: Uint8Array,
  latCol: string,
  lonCol: string,
  crs = "EPSG:4326"
): LatLon | null {
  const text = new TextDecoder().decode(bytes);
  const isCsv = fileName.toLowerCase().endsWith(".csv");

  if (isCsv) {
    const points = csvRowsToPoints(text, latCol, lonCol, crs);
    return points[0] ?? null;
  }

  try {
    const parsed = JSON.parse(text) as {
      crs?: { properties?: { name?: string } };
      features?: Array<{ geometry?: GeoJSON.Geometry }>;
    };
    const geometry = parsed.features?.[0]?.geometry;
    if (!geometry) return null;

    // GeoJSON coordinates are [lon, lat] — the opposite order of this
    // function's return value, easy to invert by mistake.
    const raw =
      geometry.type === "Point"
        ? geometry.coordinates
        : geometry.type === "Polygon"
          ? geometry.coordinates[0][0]
          : null;
    if (!raw) return null;

    const geojsonCrs = normalizeEpsg(parsed.crs?.properties?.name ?? "") ?? "EPSG:4326";
    const wgs = toWgs84(raw[0], raw[1], geojsonCrs);
    return wgs ? { lon: wgs[0], lat: wgs[1] } : null;
  } catch {
    return null;
  }
}

export function parseGridOutline(bytes: Uint8Array): GeoJSON.FeatureCollection | null {
  try {
    const text = new TextDecoder().decode(bytes);
    return JSON.parse(text) as GeoJSON.FeatureCollection;
  } catch {
    return null;
  }
}

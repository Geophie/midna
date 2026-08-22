export interface LatLon {
  lat: number;
  lon: number;
}

function splitCsvLine(line: string): string[] {
  return line.split(",").map((cell) => cell.trim());
}

function csvRowsToPoints(csvText: string, latCol: string, lonCol: string): LatLon[] {
  const lines = csvText.split(/\r\n|\r|\n/).filter((l) => l.length > 0);
  if (lines.length < 2) return [];

  const header = splitCsvLine(lines[0]);
  const latIdx = header.indexOf(latCol);
  const lonIdx = header.indexOf(lonCol);
  if (latIdx === -1 || lonIdx === -1) return [];

  const points: LatLon[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const lat = Number(cells[latIdx]);
    const lon = Number(cells[lonIdx]);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      points.push({ lat, lon });
    }
  }
  return points;
}

/** One point per valid CSV row, in file order (for numbered markers). */
export function parseCrimePoints(csvText: string, latCol: string, lonCol: string): LatLon[] {
  return csvRowsToPoints(csvText, latCol, lonCol);
}

/**
 * Matches pipeline.py's anchor convention: only the first row/geometry in
 * the file is used. File type is sniffed from its name (.csv vs
 * .geojson/.json), same as the anchor upload form itself.
 */
export function parseAnchorPoint(
  fileName: string,
  bytes: Uint8Array,
  latCol: string,
  lonCol: string
): LatLon | null {
  const text = new TextDecoder().decode(bytes);
  const isCsv = fileName.toLowerCase().endsWith(".csv");

  if (isCsv) {
    const points = csvRowsToPoints(text, latCol, lonCol);
    return points[0] ?? null;
  }

  try {
    const parsed = JSON.parse(text) as { features?: Array<{ geometry?: GeoJSON.Geometry }> };
    const geometry = parsed.features?.[0]?.geometry;
    if (!geometry) return null;

    // GeoJSON coordinates are [lon, lat] — the opposite order of this
    // function's return value, easy to invert by mistake.
    if (geometry.type === "Point") {
      const [lon, lat] = geometry.coordinates;
      return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
    }
    if (geometry.type === "Polygon") {
      const [lon, lat] = geometry.coordinates[0][0];
      return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
    }
    return null;
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

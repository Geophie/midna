import type { GridFeatureCollection, GridFeature, HeatmapView } from "@/lib/geoResult";

export const CELL_INSPECT_MIN_SIZE_PX = 14;

export interface ScreenPoint {
  x: number;
  y: number;
}

export type ProjectCoordinate = (coordinate: [number, number]) => ScreenPoint;

export function cellInspectionDetails(feature: GridFeature, view: HeatmapView): { cellId: number; score: number } {
  return {
    cellId: feature.properties.cell_id,
    score: feature.properties[view === "enhanced" ? "score_enhanced" : "score"] ?? 0,
  };
}

function visitCoordinates(value: unknown, visit: (coordinate: [number, number]) => void): void {
  if (!Array.isArray(value)) return;
  if (typeof value[0] === "number" && typeof value[1] === "number") {
    visit([value[0], value[1]]);
    return;
  }
  value.forEach((child) => visitCoordinates(child, visit));
}

export function featureMinDimensionPx(feature: GridFeature, project: ProjectCoordinate): number | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  if (feature.geometry.type === "GeometryCollection") return null;
  visitCoordinates(feature.geometry.coordinates, (coordinate) => {
    const point = project(coordinate);
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  });

  if (![minX, minY, maxX, maxY].every(Number.isFinite)) return null;
  return Math.min(maxX - minX, maxY - minY);
}

/** Recursively maps every `[x, y]` leaf of a GeoJSON coordinate tree through
 * `transform`, preserving ring / polygon nesting (Polygon and MultiPolygon).
 * Returns null if any vertex fails to transform. */
function mapCoordinateTree(
  value: unknown,
  transform: (coordinate: [number, number]) => [number, number] | null
): unknown | null {
  if (!Array.isArray(value)) return value;
  if (typeof value[0] === "number" && typeof value[1] === "number") {
    return transform([value[0], value[1]]);
  }
  const mapped: unknown[] = [];
  for (const child of value) {
    const next = mapCoordinateTree(child, transform);
    if (next === null) return null;
    mapped.push(next);
  }
  return mapped;
}

/** Builds a display-only copy of `fc` with every polygon vertex reprojected via
 * `transform` (typically analysis-CRS -> EPSG:4326). Feature properties —
 * `cell_id`, score fields, centroid — are carried over verbatim; the original
 * `fc` is never mutated. Features whose geometry can't be fully reprojected (or
 * aren't Polygon/MultiPolygon) are dropped so the caller can fall back. */
export function reprojectGridForInspection(
  fc: GridFeatureCollection,
  transform: (coordinate: [number, number]) => [number, number] | null
): GridFeatureCollection {
  const features: GridFeature[] = [];
  for (const feature of fc.features) {
    if (feature.geometry.type !== "Polygon" && feature.geometry.type !== "MultiPolygon") continue;
    const coordinates = mapCoordinateTree(feature.geometry.coordinates, transform);
    if (coordinates === null) continue;
    features.push({
      ...feature,
      geometry: { ...feature.geometry, coordinates } as GridFeature["geometry"],
    });
  }
  return { ...fc, features };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export function representativeCellMinDimensionPx(
  fc: GridFeatureCollection,
  project: ProjectCoordinate,
  cellsX: number | null,
  cellsY: number | null
): number | null {
  if (fc.features.length === 0) return null;

  const isRegularGrid =
    cellsX !== null && cellsY !== null && cellsX > 0 && cellsY > 0 && cellsX * cellsY === fc.features.length;
  if (isRegularGrid) {
    const centerIndex = Math.min(
      fc.features.length - 1,
      Math.floor(cellsY / 2) * cellsX + Math.floor(cellsX / 2)
    );
    return featureMinDimensionPx(fc.features[centerIndex], project);
  }

  const sampleSize = Math.min(25, fc.features.length);
  const stride = Math.max(1, Math.floor(fc.features.length / sampleSize));
  const dimensions: number[] = [];
  for (let index = 0; index < fc.features.length && dimensions.length < sampleSize; index += stride) {
    const dimension = featureMinDimensionPx(fc.features[index], project);
    if (dimension !== null) dimensions.push(dimension);
  }
  return median(dimensions);
}

export function canInspectCells(showContours: boolean, representativeMinDimensionPx: number | null): boolean {
  return !showContours && representativeMinDimensionPx !== null && representativeMinDimensionPx >= CELL_INSPECT_MIN_SIZE_PX;
}

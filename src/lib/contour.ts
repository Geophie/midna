import { contours, type Contours } from "d3-contour";
import {
  HEATMAP_BAND_COUNT,
  bandIndexForScore,
  bandThreshold,
  colorForBandIndex,
  estimateBandLambda,
  scoreRange,
  type GridFeatureCollection,
} from "@/lib/geoResult";

export interface ContourBand {
  bandIndex: number;
  color: string;
  threshold: number;
  geometry: GeoJSON.MultiPolygon;
}

interface PreparedContours {
  generator: Contours;
  values: number[];
  minScore: number;
  maxScore: number;
  lambda: number;
  bandCounts: number[];
  naturalBands: Array<ContourBand | null>;
  bounds: [number, number, number, number];
}

const cache = new WeakMap<GridFeatureCollection, Map<string, PreparedContours>>();

function gridBounds(fc: GridFeatureCollection): [number, number, number, number] {
  let xmin = Infinity;
  let ymin = Infinity;
  let xmax = -Infinity;
  let ymax = -Infinity;

  const visit = (value: unknown): void => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === "number" && typeof value[1] === "number") {
      xmin = Math.min(xmin, value[0]);
      ymin = Math.min(ymin, value[1]);
      xmax = Math.max(xmax, value[0]);
      ymax = Math.max(ymax, value[1]);
      return;
    }
    for (const child of value) visit(child);
  };

  for (const feature of fc.features) {
    visit((feature.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon).coordinates);
  }
  return [xmin, ymin, xmax, ymax];
}

function bandLowerEdge(
  index: number,
  minScore: number,
  maxScore: number,
  lambda: number,
  numBands: number
): number {
  if (index === numBands - 1) return minScore;
  return bandThreshold(index + 1, minScore, maxScore, lambda, numBands);
}

function transformGeometry(
  geometry: GeoJSON.MultiPolygon,
  bounds: [number, number, number, number],
  cellsX: number,
  cellsY: number
): GeoJSON.MultiPolygon {
  const [xmin, ymin, xmax, ymax] = bounds;
  const cellWidth = (xmax - xmin) / cellsX;
  const cellHeight = (ymax - ymin) / cellsY;
  return {
    type: "MultiPolygon",
    coordinates: geometry.coordinates.map((polygon) =>
      polygon.map((ring) => ring.map(([x, y]) => [xmin + x * cellWidth, ymin + y * cellHeight]))
    ),
  };
}

function prepareContours(
  fc: GridFeatureCollection,
  scoreKey: "score" | "score_enhanced",
  cellsX: number,
  cellsY: number,
  numBands: number
): PreparedContours | null {
  if (cellsX <= 0 || cellsY <= 0 || fc.features.length !== cellsX * cellsY) return null;

  const key = `${scoreKey}:${cellsX}:${cellsY}:${numBands}`;
  const cached = cache.get(fc)?.get(key);
  if (cached) return cached;

  const [minScore, maxScore] = scoreRange(fc, scoreKey, true);
  if (maxScore <= minScore) return null;
  const lambda = estimateBandLambda(fc, scoreKey);

  const sorted = [...fc.features].sort((a, b) => a.properties.cell_id - b.properties.cell_id);
  const sentinel = minScore - Math.max(1, Math.abs(maxScore - minScore));
  const values = sorted.map((feature) => {
    const score = feature.properties[scoreKey] ?? 0;
    return score === 0 ? sentinel : score;
  });
  const bandCounts = Array(numBands).fill(0) as number[];
  for (const score of values) {
    if (score !== sentinel) bandCounts[bandIndexForScore(score, minScore, maxScore, lambda, numBands)] += 1;
  }

  const bounds = gridBounds(fc);
  if (!bounds.every(Number.isFinite)) return null;
  const generator = contours().size([cellsX, cellsY]).smooth(true);
  const naturalBands = bandCounts.map((count, bandIndex): ContourBand | null => {
    if (count === 0) return null;
    const threshold = bandLowerEdge(bandIndex, minScore, maxScore, lambda, numBands);
    const geometry = transformGeometry(generator.contour(values, threshold), bounds, cellsX, cellsY);
    if (geometry.coordinates.length === 0) return null;
    return { bandIndex, color: colorForBandIndex(bandIndex), threshold, geometry };
  });

  const prepared = { generator, values, minScore, maxScore, lambda, bandCounts, naturalBands, bounds };
  const entries = cache.get(fc) ?? new Map<string, PreparedContours>();
  entries.set(key, prepared);
  cache.set(fc, entries);
  return prepared;
}

export function computeContourBands(
  fc: GridFeatureCollection,
  scoreKey: "score" | "score_enhanced",
  cellsX: number,
  cellsY: number,
  scoreThreshold: number,
  numBands = HEATMAP_BAND_COUNT
): ContourBand[] {
  const prepared = prepareContours(fc, scoreKey, cellsX, cellsY, numBands);
  if (!prepared) return [];

  const { minScore, maxScore, lambda, bandCounts, naturalBands, generator, values, bounds } = prepared;
  const threshold = Math.min(maxScore, Math.max(minScore, scoreThreshold));
  const outerBandIndex = bandIndexForScore(threshold, minScore, maxScore, lambda, numBands);
  const outerNatural = bandLowerEdge(outerBandIndex, minScore, maxScore, lambda, numBands);
  const result: ContourBand[] = [];

  if (bandCounts[outerBandIndex] > 0) {
    if (threshold === outerNatural) {
      const natural = naturalBands[outerBandIndex];
      if (natural) result.push(natural);
    } else {
      const natural = naturalBands[outerBandIndex];
      if (natural) {
        const geometry = transformGeometry(generator.contour(values, threshold), bounds, cellsX, cellsY);
        if (geometry.coordinates.length > 0) result.push({ ...natural, threshold, geometry });
      }
    }
  }

  for (let bandIndex = outerBandIndex - 1; bandIndex >= 0; bandIndex -= 1) {
    const band = naturalBands[bandIndex];
    if (band) result.push(band);
  }
  return result;
}

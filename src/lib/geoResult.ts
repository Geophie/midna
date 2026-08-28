export interface GridFeatureProps {
  cell_id: number;
  rank: number;
  score: number;
  score_raw?: number;
  score_enhanced?: number;
  score_enhanced_raw?: number;
  effective_weight?: number;
  zero_weight_applied?: boolean;
  Longitude: number;
  Latitude: number;
  crime_count?: number;
}

export interface GridFeature {
  properties: GridFeatureProps;
  geometry: GeoJSON.Geometry;
}

export interface GridFeatureCollection {
  features: GridFeature[];
}

export type HeatmapView = "baseline" | "enhanced";

export function scoreKeyForView(view: HeatmapView): "score" | "score_enhanced" {
  return view === "enhanced" ? "score_enhanced" : "score";
}

export function isSurfaceFeature(
  feature: GridFeature,
  key: "score" | "score_enhanced"
): boolean {
  return key === "score" || feature.properties.zero_weight_applied !== true;
}

export function isFeatureVisible(
  feature: GridFeature,
  key: "score" | "score_enhanced",
  threshold: number
): boolean {
  return isSurfaceFeature(feature, key) && (feature.properties[key] ?? 0) >= threshold;
}

export const HEATMAP_BAND_COUNT = 21;

/** Exact 21-step palette (red → orange → yellow → green → cyan → blue →
 * purple/magenta → near-black), pixel-sampled from the reference legend
 * image rather than generated from a formula, so band colors match it exactly. */
const HEATMAP_BAND_COLORS = [
  "#FA0304",
  "#FE4704",
  "#FD8C07",
  "#FEC505",
  "#FFFE04",
  "#84FE04",
  "#03FF05",
  "#03FD84",
  "#07FDFD",
  "#0380FD",
  "#0102FB",
  "#790FF9",
  "#EF20F2",
  "#B411D2",
  "#7702B2",
  "#6D0AA4",
  "#5E1196",
  "#4B167A",
  "#37195A",
  "#241539",
  "#0F1015",
];

/** Rossmo scores are frequently right-skewed (a handful of cells near each
 * buffer-zone edge dominate the range, especially with steeper f/g exponents)
 * — a plain equal-width split over the raw range would dump nearly every
 * cell into the single coldest band in that case, while a pure log split
 * over-compresses the common, only-mildly-skewed case (e.g. the app's own
 * f=g=1.2 default), blending distinct bands together. A Box-Cox power
 * transform generalizes both: λ=1 is exactly linear (the `-1` shift cancels
 * out under interpolation), λ=0 is exactly `ln(x)`, and values in between
 * smoothly blend the two — see `estimateBandLambda` for how λ itself is
 * chosen per run. `x` is clamped away from zero/negative before the
 * transform (Rossmo scores are mathematically always positive, but defends
 * against a degenerate all-equal or fully-masked input). */
function boxCox(x: number, lambda: number): number {
  const clamped = Math.max(x, Number.EPSILON);
  return lambda === 0 ? Math.log(clamped) : (Math.pow(clamped, lambda) - 1) / lambda;
}

/** Auto-calibrates the Box-Cox λ used by `bandThreshold`/`bandIndexForScore`
 * from the current run's own score distribution — no manual parameter, no
 * per-f/g-value tuning. Uses the same provenance-filtered population
 * `scoreRange` does, so a valid normalized minimum remains classified while
 * an explicitly zero-weighted enhanced cell does not — avoiding a
 * *third*, differently-scoped statistic alongside the mean/stdev
 * `computeLegendBands` computes over all cells for the Z-score). Maps the
 * Fisher-Pearson skewness coefficient (0 for a symmetric distribution, large
 * for a heavy right tail) to λ via `1/(1+skew)`: mild skew → λ near 1
 * (behaves like the original linear scheme); heavy skew → λ near 0 (behaves
 * like the log scheme introduced for extreme f/g exponents). */
export function estimateBandLambda(fc: GridFeatureCollection, key: "score" | "score_enhanced"): number {
  const scores = fc.features
    .filter((f) => isSurfaceFeature(f, key))
    .map((f) => f.properties[key] ?? 0);
  const n = scores.length;
  if (n === 0) return 1;

  const mean = scores.reduce((sum, v) => sum + v, 0) / n;
  const variance = scores.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
  const stdev = Math.sqrt(variance);
  if (stdev === 0) return 1;

  const skew = scores.reduce((sum, v) => sum + ((v - mean) / stdev) ** 3, 0) / n;
  const lambda = 1 / (1 + Math.max(skew, 0));
  return Math.min(1, Math.max(0, lambda));
}

/** The raw score at band `index`'s upper edge (0 = hottest band's own upper
 * edge, i.e. maxScore) — the single source of truth for band boundaries,
 * shared by `bandIndexForScore` (inverse lookup), `computeLegendBands`
 * (`actual`/`zScore`/`hitScorePct`), and the contour layer's lower-edge
 * thresholds (`src/lib/contour.ts`). `lambda` comes from `estimateBandLambda`
 * — callers share one λ per run rather than each computing their own. */
export function bandThreshold(
  index: number,
  minScore: number,
  maxScore: number,
  lambda: number,
  numBands = HEATMAP_BAND_COUNT
): number {
  if (maxScore <= minScore) return maxScore;
  const tMin = boxCox(minScore, lambda);
  const tMax = boxCox(maxScore, lambda);
  if (tMax <= tMin) return maxScore;
  const tThreshold = tMax - (index / numBands) * (tMax - tMin);
  return lambda === 0 ? Math.exp(tThreshold) : Math.pow(tThreshold * lambda + 1, 1 / lambda);
}

/** Which of the N discrete legend bands a score falls into (0 = best), by
 * equal-width interval in Box-Cox space (see `boxCox`/`estimateBandLambda`)
 * over [minScore, maxScore] — the single classification used everywhere a
 * cell needs a color: the legend (`computeLegendBands`), the default
 * per-cell map rendering (`MapView.tsx`), and the optional contour layer
 * (`src/lib/contour.ts`) — so the same score always renders the same color
 * regardless of which layer is drawing it. */
export function bandIndexForScore(
  score: number,
  minScore: number,
  maxScore: number,
  lambda: number,
  numBands = HEATMAP_BAND_COUNT
): number {
  if (maxScore <= minScore) return 0;
  const tMin = boxCox(minScore, lambda);
  const tMax = boxCox(maxScore, lambda);
  if (tMax <= tMin) return 0;
  const tScore = boxCox(score, lambda);
  const idx = Math.floor(((tMax - tScore) / (tMax - tMin)) * numBands);
  return Math.min(numBands - 1, Math.max(0, idx));
}

/** Colors for `bandIndexForScore`, in band order (0 = best) — exported so
 * contour rendering can look up a band's color without a score round-trip. */
export function colorForBandIndex(index: number): string {
  return HEATMAP_BAND_COLORS[index] ?? HEATMAP_BAND_COLORS[HEATMAP_BAND_COLORS.length - 1];
}

/** Cells within a band all render as the exact same fixed color, giving the
 * map the flat "isopleth band" look instead of a smooth gradient. */
export function bandColor(
  score: number,
  minScore: number,
  maxScore: number,
  lambda: number,
  numBands = HEATMAP_BAND_COUNT
): string {
  return colorForBandIndex(bandIndexForScore(score, minScore, maxScore, lambda, numBands));
}

export interface LegendBand {
  rank: number;
  color: string;
  priorityPct: number;
  hitScorePct: number;
  zScore: number;
  actual: number;
}

/**
 * One row per discrete band (rank 1 = best), using Box-Cox equal-width score
 * intervals (see `bandThreshold`/`bandIndexForScore`/`estimateBandLambda`)
 * rather than equal-count ones. `actual` is each band's score threshold (its
 * upper edge); `priorityPct` min-max normalizes that threshold against the
 * hottest and coldest bands' own thresholds (100% / 0% respectively,
 * proportional in between) — the same relative-priority definition the
 * reference guide documents, verified against all 21 of its printed rows to within
 * ≤0.3 percentage points. Data-derived, not a fixed reference scale: two
 * different datasets produce two different Priority % sequences, matching
 * the reference tool's own behavior rather than always printing the same 21 numbers.
 * `zScore` is how many standard deviations that threshold sits from the mean
 * of all cell scores; `hitScorePct` is the cumulative share of grid cells at
 * or above the threshold, used as the area-share measure for the regular
 * equal-cell grid. These are computed from the actual run, so they won't
 * line up evenly.
 */
export function computeLegendBands(
  fc: GridFeatureCollection,
  key: "score" | "score_enhanced",
  numBands = HEATMAP_BAND_COUNT
): LegendBand[] {
  const features = fc.features.filter((f) => isSurfaceFeature(f, key));
  const scores = features.map((f) => f.properties[key] ?? 0);
  const totalCells = scores.length;
  if (totalCells === 0) return [];

  const mean = scores.reduce((sum, v) => sum + v, 0) / totalCells;
  const variance = scores.reduce((sum, v) => sum + (v - mean) ** 2, 0) / totalCells;
  const stdev = Math.sqrt(variance);

  const [minScore, maxScore] = scoreRange(fc, key);
  const lambda = estimateBandLambda(fc, key);

  const thresholds = Array.from({ length: numBands }, (_, i) =>
    bandThreshold(i, minScore, maxScore, lambda, numBands)
  );
  const actualFirst = thresholds[0];
  const actualLast = thresholds[numBands - 1];
  const actualSpread = actualFirst - actualLast;

  const bands: LegendBand[] = [];
  for (let i = 0; i < numBands; i++) {
    const threshold = thresholds[i];
    let capturedCells = 0;
    for (const f of features) {
      if ((f.properties[key] ?? 0) >= threshold) capturedCells += 1;
    }
    bands.push({
      rank: i + 1,
      color: HEATMAP_BAND_COLORS[i] ?? HEATMAP_BAND_COLORS[HEATMAP_BAND_COLORS.length - 1],
      priorityPct: actualSpread === 0 ? 0 : (100 * (threshold - actualLast)) / actualSpread,
      hitScorePct: (100 * capturedCells) / totalCells,
      zScore: stdev === 0 ? 0 : (threshold - mean) / stdev,
      actual: threshold,
    });
  }
  return bands;
}

export function parseGridFeatureCollection(geoJson: string): GridFeatureCollection {
  return JSON.parse(geoJson) as GridFeatureCollection;
}

/** Min/max of a score field across all features — used to bound the threshold
 * slider when scores aren't normalized (and so have no fixed 0–100 range), and
 * to anchor the equal-interval color bands. Enhanced cells with an explicitly
 * recorded zero environmental weight are outside the rendered analytical
 * surface; numeric zero alone remains a valid normalized minimum. */
export function scoreRange(
  fc: GridFeatureCollection,
  key: "score" | "score_enhanced"
): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const f of fc.features) {
    if (!isSurfaceFeature(f, key)) continue;
    const v = f.properties[key];
    if (v === undefined) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 0];
  return [min, max];
}

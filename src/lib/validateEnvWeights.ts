import type { DemExtraBand, LayerSpec } from "@/workers/pyodide.worker";

/**
 * Environmental numeric fields the browser pipeline reads with strict key
 * access (public/py/webcore/pipeline.py). Each must reach Python as an explicit
 * finite value from the current layer configuration.
 */
const DEM_THRESHOLD_FIELDS = ["pianuraMin", "collinaMin", "montagnaMin"] as const;

const DEM_WEIGHT_FIELDS = ["lowWeight", "midWeight", "highWeight", "nodataWeight"] as const;

const VECTOR_FIELDS = ["intersectWeight", "noIntersectWeight"] as const;

/**
 * Shared definition of the DEM threshold ordering rule, so the Run-time
 * validator and the immediate UI feedback in LayerCard never diverge.
 *
 * Only meaningful when every threshold is finite — callers must check
 * finiteness separately before trusting the result (NaN comparisons are
 * always false, which would otherwise read as "invalid order").
 */
export function isDemThresholdOrderValid(thresholds: number[]): boolean {
  for (let i = 1; i < thresholds.length; i++) {
    if (!(thresholds[i - 1] < thresholds[i])) return false;
  }
  return true;
}

/**
 * Full ordered minimum-elevation threshold sequence for a DEM layer: every
 * optional lower band (ascending, closest-to-Plain last), the three core
 * classes, then every optional upper band (ascending, closest-to-Mountain
 * first). This exact sequence must be strictly increasing — see
 * isDemThresholdOrderValid.
 */
export function demThresholdSequence(layer: {
  pianuraMin: number;
  collinaMin: number;
  montagnaMin: number;
  lowerBands: DemExtraBand[];
  upperBands: DemExtraBand[];
}): number[] {
  return [
    ...layer.lowerBands.map((b) => b.threshold),
    layer.pianuraMin,
    layer.collinaMin,
    layer.montagnaMin,
    ...layer.upperBands.map((b) => b.threshold),
  ];
}

/**
 * Structural integrity check only — NOT a methodological range.
 *
 * DEM thresholds (pianuraMin/collinaMin/montagnaMin, plus any optional
 * lower/upper band thresholds) accept any finite number, since elevations
 * below sea level are valid, but must be strictly progressive across the
 * whole sequence — see demThresholdSequence. All weight fields (including
 * per-band weights) require a finite value >= 0.
 *
 * Rejects: missing, blank, non-numeric, NaN, +Infinity, -Infinity, negative
 * weights, out-of-order DEM thresholds.
 *
 * Returns an i18n error key when a layer carries an invalid environmental
 * value, or null when every enabled layer is structurally valid.
 */
export function validateEnvWeights(layers: LayerSpec[]): string | null {
  const isFinite = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value);

  for (const layer of layers) {
    const record = layer as unknown as Record<string, unknown>;
    const thresholdFields = layer.type === "dem" ? DEM_THRESHOLD_FIELDS : [];
    const weightFields = layer.type === "dem" ? DEM_WEIGHT_FIELDS : VECTOR_FIELDS;

    for (const field of thresholdFields) {
      if (!isFinite(record[field])) {
        return "error_env_weight_invalid";
      }
    }
    for (const field of weightFields) {
      const value = record[field];
      if (!isFinite(value) || value < 0) {
        return "error_env_weight_invalid";
      }
    }

    if (layer.type === "dem") {
      for (const band of [...layer.lowerBands, ...layer.upperBands]) {
        if (!isFinite(band.threshold)) return "error_env_weight_invalid";
        if (!isFinite(band.weight) || band.weight < 0) return "error_env_weight_invalid";
      }
      if (!isDemThresholdOrderValid(demThresholdSequence(layer))) {
        return "error_env_threshold_order";
      }
    }
  }
  return null;
}

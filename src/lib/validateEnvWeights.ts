import type { LayerSpec } from "@/workers/pyodide.worker";

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
 * Only meaningful when all three values are finite — callers must check
 * finiteness separately before trusting the result (NaN comparisons are
 * always false, which would otherwise read as "invalid order").
 */
export function isDemThresholdOrderValid(pianuraMin: number, collinaMin: number, montagnaMin: number): boolean {
  return pianuraMin < collinaMin && collinaMin < montagnaMin;
}

/**
 * Structural integrity check only — NOT a methodological range.
 *
 * DEM thresholds (pianuraMin/collinaMin/montagnaMin) accept any finite number,
 * since elevations below sea level are valid, but must be strictly
 * progressive (pianuraMin < collinaMin < montagnaMin). All weight fields
 * require a finite value >= 0.
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
    if (layer.type === "dem") {
      if (!isDemThresholdOrderValid(layer.pianuraMin, layer.collinaMin, layer.montagnaMin)) {
        return "error_env_threshold_order";
      }
    }
    for (const field of weightFields) {
      const value = record[field];
      if (!isFinite(value) || value < 0) {
        return "error_env_weight_invalid";
      }
    }
  }
  return null;
}

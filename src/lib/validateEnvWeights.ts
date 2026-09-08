import type { LayerSpec } from "@/workers/pyodide.worker";

/**
 * Environmental numeric fields the browser pipeline reads with strict key
 * access (public/py/webcore/pipeline.py). Each must reach Python as an explicit
 * finite value from the current layer configuration.
 */
const DEM_FIELDS = [
  "pianuraMin",
  "collinaMin",
  "montagnaMin",
  "lowWeight",
  "midWeight",
  "highWeight",
  "nodataWeight",
] as const;

const VECTOR_FIELDS = ["intersectWeight", "noIntersectWeight"] as const;

/**
 * Structural integrity check only — NOT a methodological range.
 *
 * Rejects: missing, blank, non-numeric, NaN, +Infinity, -Infinity
 * Accepts unchanged: every finite number, including negatives, 0, and values > 1.
 *
 * Returns an i18n error key when a layer carries a non-finite environmental
 * value, or null when every enabled layer is structurally valid.
 */
export function validateEnvWeights(layers: LayerSpec[]): string | null {
  for (const layer of layers) {
    const fields = layer.type === "dem" ? DEM_FIELDS : VECTOR_FIELDS;
    for (const field of fields) {
      const value = (layer as unknown as Record<string, unknown>)[field];
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return "error_env_weight_invalid";
      }
    }
  }
  return null;
}

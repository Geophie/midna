/**
 * Parser for environmental-weight and DEM-threshold text inputs.
 *
 * Differs from parseLocaleFloat in one way: a blank or whitespace-only field
 * yields NaN instead of 0. `Number("")` is 0, which would let a cleared weight
 * field masquerade as a deliberate zero; validateEnvWeights rejects NaN, so a
 * blank field is surfaced as invalid while an explicitly typed 0 stays valid.
 *
 * Accepts the same locale decimal comma as parseLocaleFloat. No clamping, no
 * range check — negative values and values > 1 pass through unchanged.
 */
export function parseWeightInput(raw: string): number {
  const trimmed = raw.trim().replace(",", ".");
  if (trimmed === "") return NaN;
  return Number(trimmed);
}

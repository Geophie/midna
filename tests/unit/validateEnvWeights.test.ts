import { describe, expect, it } from "vitest";
import { validateEnvWeights } from "@/lib/validateEnvWeights";
import { parseWeightInput } from "@/lib/parseWeightInput";
import type { DemLayerSpec, VectorLayerSpec } from "@/workers/pyodide.worker";

function demLayer(over: Partial<DemLayerSpec> = {}): DemLayerSpec {
  return {
    type: "dem",
    name: "DEM",
    fileName: "",
    fileBytes: new Uint8Array(),
    enabled: true,
    pianuraMin: 0,
    collinaMin: 250,
    montagnaMin: 350,
    lowWeight: 0.4,
    midWeight: 0.8,
    highWeight: 0,
    nodataWeight: 0,
    ...over,
  };
}

function vectorLayer(over: Partial<VectorLayerSpec> = {}): VectorLayerSpec {
  return {
    type: "inclusion",
    name: "incl",
    files: [],
    enabled: true,
    intersectWeight: 1,
    noIntersectWeight: 0,
    ...over,
  };
}

describe("validateEnvWeights — accepts every finite value, rejects only non-finite/missing", () => {
  it("A. accepts negative, zero, sub-1, 1, and >1 finite weights unchanged", () => {
    for (const w of [-10, -1, -0.25, 0, 0.373, 1, 2.5, 100]) {
      expect(validateEnvWeights([vectorLayer({ intersectWeight: w, noIntersectWeight: w })])).toBeNull();
      expect(validateEnvWeights([demLayer({ lowWeight: w, midWeight: w, highWeight: w, nodataWeight: w })])).toBeNull();
    }
  });

  it("B. an explicit 0 is valid (not treated as missing)", () => {
    expect(validateEnvWeights([vectorLayer({ intersectWeight: 0, noIntersectWeight: 0 })])).toBeNull();
    expect(validateEnvWeights([demLayer({ lowWeight: 0, midWeight: 0, highWeight: 0, nodataWeight: 0 })])).toBeNull();
  });

  it("C. a blank field (parseWeightInput('') -> NaN) is rejected, not coerced to 0", () => {
    expect(parseWeightInput("")).toBeNaN();
    expect(parseWeightInput("   ")).toBeNaN();
    expect(validateEnvWeights([vectorLayer({ intersectWeight: parseWeightInput("") })])).toBe(
      "error_env_weight_invalid",
    );
  });

  it("D. NaN is rejected", () => {
    expect(validateEnvWeights([vectorLayer({ intersectWeight: NaN })])).toBe("error_env_weight_invalid");
    expect(validateEnvWeights([demLayer({ collinaMin: NaN })])).toBe("error_env_weight_invalid");
  });

  it("E. +Infinity is rejected", () => {
    expect(validateEnvWeights([vectorLayer({ noIntersectWeight: Infinity })])).toBe("error_env_weight_invalid");
  });

  it("F. -Infinity is rejected", () => {
    expect(validateEnvWeights([vectorLayer({ noIntersectWeight: -Infinity })])).toBe("error_env_weight_invalid");
  });

  it("G. a structurally missing field is rejected", () => {
    const broken = vectorLayer();
    delete (broken as Partial<VectorLayerSpec>).intersectWeight;
    expect(validateEnvWeights([broken as VectorLayerSpec])).toBe("error_env_weight_invalid");
  });

  it("parseWeightInput keeps locale comma and finite values, no clamping", () => {
    expect(parseWeightInput("0,373")).toBe(0.373);
    expect(parseWeightInput("-0,25")).toBe(-0.25);
    expect(parseWeightInput("2.5")).toBe(2.5);
    expect(parseWeightInput("100")).toBe(100);
    expect(parseWeightInput("abc")).toBeNaN();
  });
});

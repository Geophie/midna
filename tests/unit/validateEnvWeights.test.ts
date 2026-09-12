import { describe, expect, it } from "vitest";
import { validateEnvWeights } from "@/lib/validateEnvWeights";
import { parseWeightInput } from "@/lib/parseWeightInput";
import type { DemExtraBand, DemLayerSpec, VectorLayerSpec } from "@/workers/pyodide.worker";

function band(threshold: number, weight = 0.1): DemExtraBand {
  return { id: `band-${threshold}`, threshold, weight };
}

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
    lowerBands: [],
    upperBands: [],
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

describe("validateEnvWeights — weights reject negatives, DEM thresholds allow negatives", () => {
  it("A. accepts zero, sub-1, 1, and >1 finite weights", () => {
    for (const w of [0, 0.373, 1, 2.5, 100]) {
      expect(validateEnvWeights([vectorLayer({ intersectWeight: w, noIntersectWeight: w })])).toBeNull();
      expect(validateEnvWeights([demLayer({ lowWeight: w, midWeight: w, highWeight: w, nodataWeight: w })])).toBeNull();
    }
  });

  it("B. an explicit 0 is valid (not treated as missing)", () => {
    expect(validateEnvWeights([vectorLayer({ intersectWeight: 0, noIntersectWeight: 0 })])).toBeNull();
    expect(validateEnvWeights([demLayer({ lowWeight: 0, midWeight: 0, highWeight: 0, nodataWeight: 0 })])).toBeNull();
  });

  it("H. rejects negative weights", () => {
    expect(validateEnvWeights([vectorLayer({ intersectWeight: -0.1 })])).toBe("error_env_weight_invalid");
    expect(validateEnvWeights([vectorLayer({ noIntersectWeight: -1 })])).toBe("error_env_weight_invalid");
    expect(validateEnvWeights([demLayer({ lowWeight: -0.1 })])).toBe("error_env_weight_invalid");
    expect(validateEnvWeights([demLayer({ midWeight: -1 })])).toBe("error_env_weight_invalid");
    expect(validateEnvWeights([demLayer({ highWeight: -10 })])).toBe("error_env_weight_invalid");
    expect(validateEnvWeights([demLayer({ nodataWeight: -0.25 })])).toBe("error_env_weight_invalid");
  });

  it("I. accepts negative finite DEM thresholds (sub-sea-level elevations)", () => {
    expect(validateEnvWeights([demLayer({ pianuraMin: -100, collinaMin: 50, montagnaMin: 400 })])).toBeNull();
    expect(validateEnvWeights([demLayer({ pianuraMin: -200, collinaMin: -50, montagnaMin: 350 })])).toBeNull();
    expect(validateEnvWeights([demLayer({ pianuraMin: -500, collinaMin: -100, montagnaMin: -10 })])).toBeNull();
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

  it("J. accepts strictly progressive DEM thresholds", () => {
    expect(validateEnvWeights([demLayer({ pianuraMin: 0, collinaMin: 250, montagnaMin: 350 })])).toBeNull();
    expect(validateEnvWeights([demLayer({ pianuraMin: -100, collinaMin: 50, montagnaMin: 400 })])).toBeNull();
    expect(validateEnvWeights([demLayer({ pianuraMin: -500, collinaMin: -100, montagnaMin: 50 })])).toBeNull();
  });

  it("K. rejects non-progressive or equal DEM thresholds", () => {
    const cases: Array<[number, number, number]> = [
      [300, 250, 350],
      [0, 400, 350],
      [0, 250, 250],
      [250, 250, 350],
      [400, 300, 200],
    ];
    for (const [pianuraMin, collinaMin, montagnaMin] of cases) {
      expect(validateEnvWeights([demLayer({ pianuraMin, collinaMin, montagnaMin })])).toBe(
        "error_env_threshold_order",
      );
    }
  });

  it("L. accepts a full valid lower+core+upper sequence: -200 < -50 < 0 < 250 < 350 < 700 < 1200", () => {
    expect(
      validateEnvWeights([
        demLayer({
          lowerBands: [band(-200), band(-50)],
          pianuraMin: 0,
          collinaMin: 250,
          montagnaMin: 350,
          upperBands: [band(700), band(1200)],
        }),
      ]),
    ).toBeNull();
  });

  it("M. rejects invalid combined sequences (no auto-sort, no auto-fix)", () => {
    const cases: Array<Partial<DemLayerSpec>> = [
      // -50, -200, 0, 250, 350 — lower bands out of order
      { lowerBands: [band(-50), band(-200)] },
      // -100, 50, 0, 250, 350 — lower band above pianuraMin
      { lowerBands: [band(-100), band(50)] },
      // 0, 250, 350, 300 — upper band below montagnaMin
      { upperBands: [band(300)] },
      // 0, 250, 350, 700, 600 — upper bands out of order
      { upperBands: [band(700), band(600)] },
      // 0, 250, 250 — collinaMin equals montagnaMin
      { collinaMin: 250, montagnaMin: 250 },
      // 0, 250, 350, 350 — upper band equals montagnaMin
      { upperBands: [band(350)] },
      // lower A = -100, lower B = -200 — duplicate-style inversion among lower bands
      { lowerBands: [band(-100), band(-200)] },
    ];
    for (const over of cases) {
      expect(validateEnvWeights([demLayer(over)])).toBe("error_env_threshold_order");
    }
  });

  it("N. rejects a non-finite or negative weight on an optional band", () => {
    expect(validateEnvWeights([demLayer({ lowerBands: [band(-200, NaN)] })])).toBe("error_env_weight_invalid");
    expect(validateEnvWeights([demLayer({ upperBands: [band(700, -0.1)] })])).toBe("error_env_weight_invalid");
  });

  it("O. rejects a non-finite threshold on an optional band", () => {
    expect(validateEnvWeights([demLayer({ lowerBands: [band(Infinity)] })])).toBe("error_env_weight_invalid");
  });

  it("P. accepts an explicit zero weight and a negative threshold on an optional band", () => {
    expect(validateEnvWeights([demLayer({ lowerBands: [band(-200, 0)] })])).toBeNull();
  });

  it("parseWeightInput keeps locale comma and finite values, no clamping", () => {
    expect(parseWeightInput("0,373")).toBe(0.373);
    expect(parseWeightInput("-0,25")).toBe(-0.25);
    expect(parseWeightInput("2.5")).toBe(2.5);
    expect(parseWeightInput("100")).toBe(100);
    expect(parseWeightInput("abc")).toBeNaN();
  });
});

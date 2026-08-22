import { describe, expect, it } from "vitest";
import {
  scoreKeyForView,
  scoreRange,
  bandIndexForScore,
  bandColor,
  colorForBandIndex,
  computeLegendBands,
  estimateBandLambda,
  type GridFeatureCollection,
} from "@/lib/geoResult";

describe("scoreKeyForView", () => {
  it("maps view names to score column names", () => {
    expect(scoreKeyForView("baseline")).toBe("score");
    expect(scoreKeyForView("enhanced")).toBe("score_enhanced");
  });
});

function fcOf(scores: number[], enhanced?: number[], crimeCounts?: number[]): GridFeatureCollection {
  return {
    features: scores.map((score, i) => ({
      properties: {
        cell_id: i,
        rank: i + 1,
        score,
        score_enhanced: enhanced?.[i],
        Longitude: 0,
        Latitude: 0,
        crime_count: crimeCounts?.[i],
      },
      geometry: { type: "Point", coordinates: [0, 0] },
    })),
  };
}

describe("scoreRange", () => {
  it("returns min/max of the requested score field", () => {
    expect(scoreRange(fcOf([3, 1, 4, 1, 5]), "score")).toEqual([1, 5]);
  });

  it("reads score_enhanced independently from score", () => {
    const fc = fcOf([10, 20], [1, 2]);
    expect(scoreRange(fc, "score")).toEqual([10, 20]);
    expect(scoreRange(fc, "score_enhanced")).toEqual([1, 2]);
  });

  it("returns [0, 0] for an empty collection or a missing field", () => {
    expect(scoreRange(fcOf([]), "score")).toEqual([0, 0]);
    expect(scoreRange(fcOf([1, 2]), "score_enhanced")).toEqual([0, 0]);
  });
});

describe("bandIndexForScore / bandColor / colorForBandIndex", () => {
  // Box-Cox equal-width classification used everywhere a cell needs a color:
  // the legend, the default map rendering, and the optional contour layer.
  // lambda=1 collapses to the original raw equal-width scheme; lambda=0 is
  // the log-space scheme introduced for extreme right-skew (see
  // estimateBandLambda below for how lambda is actually chosen per run).
  it.each([0, 0.5, 1])("assigns the highest score to band 0 and the lowest score to the last band (lambda=%s)", (lambda) => {
    expect(bandIndexForScore(210, 1, 210, lambda)).toBe(0);
    expect(bandIndexForScore(1, 1, 210, lambda)).toBe(20);
  });

  it("colors band 0 red and the last band near-black regardless of lambda", () => {
    expect(bandColor(210, 1, 210, 0)).toBe("#FA0304");
    expect(bandColor(1, 1, 210, 0)).toBe("#0F1015");
    expect(bandColor(210, 1, 210, 1)).toBe("#FA0304");
    expect(bandColor(1, 1, 210, 1)).toBe("#0F1015");
    expect(colorForBandIndex(bandIndexForScore(210, 1, 210, 1))).toBe("#FA0304");
  });

  it("at lambda=1, groups scores the same way a raw equal-width split would", () => {
    // band width = (210-1)/21 ≈ 9.95
    expect(bandIndexForScore(210, 1, 210, 1)).toBe(bandIndexForScore(202, 1, 210, 1));
  });

  it("at lambda=0, groups multiple scores within the same log-space interval into the same band", () => {
    // band 0's lower edge is exp(ln(210) - ln(210)/21) ≈ 162.8 — everything
    // above that (not just values within ~9.95 of 210) shares band 0.
    expect(bandIndexForScore(210, 1, 210, 0)).toBe(bandIndexForScore(163, 1, 210, 0));
    // band 20's upper edge is exp(ln(210)/21) ≈ 1.29 — small absolute gaps
    // near the low end still land in the same band, unlike a raw
    // equal-width split where they'd be spread across many bands.
    expect(bandIndexForScore(1.2, 1, 210, 0)).toBe(bandIndexForScore(1, 1, 210, 0));
  });

  it("splits orders of magnitude into separate bands at lambda=0, unlike lambda=1", () => {
    expect(bandIndexForScore(1, 1, 1_000_000, 0)).not.toBe(bandIndexForScore(5, 1, 1_000_000, 0));
    expect(bandIndexForScore(1, 1, 1_000_000, 1)).toBe(bandIndexForScore(5, 1, 1_000_000, 1));
  });
});

describe("estimateBandLambda", () => {
  it("returns 1 (linear-like) for a near-symmetric score distribution", () => {
    const fc = fcOf([8, 9, 10, 11, 12]);
    expect(estimateBandLambda(fc, "score")).toBeCloseTo(1, 5);
  });

  it("returns a value well below 1 for a heavily right-skewed distribution", () => {
    // One large outlier among many small, uniform values — the shape a
    // steep-exponent Rossmo surface (e.g. f=4, g=8) produces.
    const scores = [...Array(100).fill(1), 100_000];
    const fc = fcOf(scores);
    expect(estimateBandLambda(fc, "score")).toBeLessThan(0.2);
  });

  it("excludes zero-score (masked/no-signal) cells from the estimate", () => {
    const withZeros = fcOf([0, 0, 0, 8, 9, 10, 11, 12]);
    const withoutZeros = fcOf([8, 9, 10, 11, 12]);
    expect(estimateBandLambda(withZeros, "score")).toBeCloseTo(estimateBandLambda(withoutZeros, "score"), 10);
  });

  it("returns 1 for a degenerate all-equal (zero-stdev) distribution", () => {
    expect(estimateBandLambda(fcOf([5, 5, 5, 5]), "score")).toBe(1);
  });
});

describe("computeLegendBands", () => {
  it("returns 21 rows with priority 100% down to 0% and rank 1..21", () => {
    const scores = Array.from({ length: 210 }, (_, i) => 210 - i); // 210..1
    const bands = computeLegendBands(fcOf(scores), "score");
    expect(bands).toHaveLength(21);
    expect(bands[0].priorityPct).toBeCloseTo(100);
    expect(bands[20].priorityPct).toBeCloseTo(0);
    expect(bands[0].rank).toBe(1);
    expect(bands[20].rank).toBe(21);
  });

  it("priorityPct is derived from this run's own thresholds, not a fixed reference scale", () => {
    // The reference guide: Priority% min-max normalizes each band's own Actual
    // threshold against the hottest/coldest bands' thresholds — so two
    // datasets with different score shapes should disagree at some
    // intermediate rank, unlike a fixed per-rank reference array.
    const symmetric = computeLegendBands(fcOf(Array.from({ length: 210 }, (_, i) => 210 - i)), "score");
    const skewed = computeLegendBands(fcOf([...Array(200).fill(1), 210]), "score");
    expect(symmetric[10].priorityPct).not.toBeCloseTo(skewed[10].priorityPct, 1);
    // Both extremes still anchor to exactly 100%/0% regardless of shape.
    expect(skewed[0].priorityPct).toBeCloseTo(100, 5);
    expect(skewed[20].priorityPct).toBeCloseTo(0, 5);
  });

  it("priorityPct falls back to 0 (not NaN) for a degenerate all-equal-score run", () => {
    const bands = computeLegendBands(fcOf(Array(21).fill(5)), "score");
    for (const band of bands) expect(band.priorityPct).toBe(0);
  });

  it("band thresholds are equal-width in raw score for a symmetric (unskewed) run", () => {
    // A uniform 1..210 run has ~zero skew, so estimateBandLambda picks
    // lambda≈1 — computeLegendBands should then match the plain
    // linear-threshold formula (band 1's edge at 210 - 209/21 ≈ 200.05).
    const scores = Array.from({ length: 210 }, (_, i) => 210 - i);
    const bands = computeLegendBands(fcOf(scores), "score");
    expect(bands[0].actual).toBeCloseTo(210, 5);
    expect(bands[1].actual).toBeCloseTo(210 - 209 / 21, 5);
  });

  it("band thresholds skew toward log-space for a heavily right-skewed run", () => {
    const scores = [...Array(200).fill(1), 210];
    const fc = fcOf(scores);
    const lambda = estimateBandLambda(fc, "score");
    expect(lambda).toBeLessThan(0.2); // confirms this fixture is meaningfully skewed
    const bands = computeLegendBands(fc, "score");
    // A pure linear threshold would put band 1's edge at 210 - 209/21 ≈ 200.05;
    // the skew-adapted edge should be well below that.
    expect(bands[1].actual).toBeLessThan(190);
  });

  it("hitScorePct counts cells at or above each band's upper-edge threshold (symmetric run)", () => {
    const scores = Array.from({ length: 21 }, (_, i) => 21 - i);
    const bands = computeLegendBands(fcOf(scores), "score");
    expect(bands[0].hitScorePct).toBeCloseTo((1 / 21) * 100, 5);
    expect(bands[1].hitScorePct).toBeCloseTo((1 / 21) * 100, 5);
    expect(bands[20].hitScorePct).toBeCloseTo((20 / 21) * 100, 5);
  });

  it("hitScorePct does not depend on crime_count", () => {
    const scores = [100, 50, ...Array(19).fill(1)];
    const bandsA = computeLegendBands(fcOf(scores, undefined, [18, 10, ...Array(19).fill(1)]), "score");
    const bandsB = computeLegendBands(fcOf(scores, undefined, Array(21).fill(1)), "score");
    expect(bandsA.map((b) => b.hitScorePct)).toEqual(bandsB.map((b) => b.hitScorePct));
  });

  it("returns [] for an empty collection", () => {
    expect(computeLegendBands(fcOf([]), "score")).toEqual([]);
  });
});

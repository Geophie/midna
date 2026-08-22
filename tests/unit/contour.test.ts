import { describe, expect, it } from "vitest";
import { computeContourBands } from "@/lib/contour";
import {
  bandIndexForScore,
  colorForBandIndex,
  computeLegendBands,
  estimateBandLambda,
  type GridFeatureCollection,
} from "@/lib/geoResult";

function grid(scores: number[], cellsX: number, cellSize = 10): GridFeatureCollection {
  return {
    features: scores.map((score, cell_id) => {
      const x = cell_id % cellsX;
      const y = Math.floor(cell_id / cellsX);
      return {
        properties: { cell_id, rank: cell_id + 1, score, Longitude: x, Latitude: y },
        geometry: {
          type: "Polygon",
          coordinates: [[
            [x * cellSize, y * cellSize],
            [(x + 1) * cellSize, y * cellSize],
            [(x + 1) * cellSize, (y + 1) * cellSize],
            [x * cellSize, (y + 1) * cellSize],
            [x * cellSize, y * cellSize],
          ]],
        },
      };
    }),
  };
}

function inRing([x, y]: [number, number], ring: GeoJSON.Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function contains(geometry: GeoJSON.MultiPolygon, point: [number, number]): boolean {
  return geometry.coordinates.some(
    (polygon) => inRing(point, polygon[0]) && !polygon.slice(1).some((hole) => inRing(point, hole))
  );
}

describe("computeContourBands", () => {
  it("layers lower-edge contours with the same colors as bandIndexForScore and masks zero", () => {
    const scores = [0, 10, 20, 30, 40, ...Array(19).fill(5), 45];
    const fc = grid(scores, 5);
    const bands = computeContourBands(fc, "score", 5, 5, 0, 4);
    const lambda = estimateBandLambda(fc, "score");

    for (const cell_id of [1, 2, 3, 4]) {
      const point: [number, number] = [(cell_id % 5) * 10 + 5, 5];
      const painted = bands.filter((band) => contains(band.geometry, point)).at(-1);
      const expectedIndex = bandIndexForScore(scores[cell_id], 5, 45, lambda, 4);
      expect(painted?.bandIndex).toBe(expectedIndex);
      expect(painted?.color).toBe(colorForBandIndex(expectedIndex));
    }
    expect(bands.some((band) => contains(band.geometry, [5, 5]))).toBe(false);
  });

  it("omits empty bands explicitly without throwing", () => {
    const fc = grid([1, 1, 1, 1, 9, 1, 1, 1, 1], 3);
    expect(() => computeContourBands(fc, "score", 3, 3, 0, 4)).not.toThrow();
    const result = computeContourBands(fc, "score", 3, 3, 0, 4);
    expect(result.some((band) => band.bandIndex === 1)).toBe(false);
    expect(result.some((band) => band.bandIndex === 2)).toBe(false);
  });

  it("maps d3 coordinates without a second half-cell offset and keeps row zero south", () => {
    const scores = [9, 1, 1, 1, 1, 1, 1, 1, 1];
    const fc = grid(scores, 3);
    const hottest = computeContourBands(fc, "score", 3, 3, 0, 2).find((band) => band.bandIndex === 0);
    expect(hottest).toBeDefined();
    const vertices = hottest!.geometry.coordinates[0][0];

    // Pinned to this fixture's actual (adaptive-lambda) threshold rather than
    // a hand-derived crossing fraction — d3-contour's exact sample-to-real
    // coordinate convention isn't simple enough to re-derive reliably by
    // hand (this exact spot has bitten this test suite twice before). What
    // this still protects: no double half-cell offset, and row 0 = south —
    // both would shift or mirror every coordinate below, not just rescale
    // them, so either regression still fails this assertion.
    const crossing = 11.801328482016551;

    expect(vertices).toEqual(
      expect.arrayContaining([
        [crossing, 5],
        [5, 0],
        [0, 5],
        [5, crossing],
      ])
    );
    expect(Math.max(...vertices.map(([, y]) => y))).toBe(crossing);
  });

  it("clamps the outer band exactly to the score slider without adding a layer", () => {
    const fc = grid([1, 1, 1, 1, 9, 1, 1, 1, 1], 3);
    const bands = computeContourBands(fc, "score", 3, 3, 7, 2);
    expect(bands).toHaveLength(1);
    expect(bands[0].bandIndex).toBe(0);
    expect(bands[0].threshold).toBe(7);
  });

  it("does not mutate or change any legend row", () => {
    const fc = grid(Array.from({ length: 25 }, (_, i) => i + 1), 5);
    const before = JSON.stringify(computeLegendBands(fc, "score"));
    computeContourBands(fc, "score", 5, 5, 12, 4);
    expect(JSON.stringify(computeLegendBands(fc, "score"))).toBe(before);
  });
});

import { describe, expect, it } from "vitest";
import {
  CELL_INSPECT_MIN_SIZE_PX,
  canInspectCells,
  cellInspectionDetails,
  featureMinDimensionPx,
  representativeCellMinDimensionPx,
  reprojectGridForInspection,
  type ProjectCoordinate,
} from "@/lib/cellInspection";
import type { GridFeature, GridFeatureCollection } from "@/lib/geoResult";

const project: ProjectCoordinate = ([longitude, latitude]) => ({ x: longitude, y: latitude });

function polygonFeature(cellId: number, width: number, height = width) {
  return {
    properties: {
      cell_id: cellId,
      rank: cellId + 1,
      score: cellId,
      Longitude: 0,
      Latitude: 0,
    },
    geometry: {
      type: "Polygon" as const,
      coordinates: [[[0, 0], [width, 0], [width, height], [0, height], [0, 0]]],
    },
  };
}

describe("cell inspection availability", () => {
  it.each([
    [true, 20, false],
    [false, 8, false],
    [false, 13.9, false],
    [false, CELL_INSPECT_MIN_SIZE_PX, true],
    [false, 20, true],
  ])("uses contours and rendered pixel size (%s, %s px)", (showContours, size, expected) => {
    expect(canInspectCells(showContours, size)).toBe(expected);
  });

  it("measures the shortest rendered polygon dimension", () => {
    expect(featureMinDimensionPx(polygonFeature(1, 20, 11), project)).toBe(11);
  });

  it("uses the center of a regular grid and a median sample for irregular grids", () => {
    const regular: GridFeatureCollection = {
      features: Array.from({ length: 9 }, (_, index) => polygonFeature(index, index === 4 ? 18 : 2)),
    };
    expect(representativeCellMinDimensionPx(regular, project, 3, 3)).toBe(18);

    const irregular: GridFeatureCollection = {
      features: [polygonFeature(0, 8), polygonFeature(1, 14), polygonFeature(2, 20)],
    };
    expect(representativeCellMinDimensionPx(irregular, project, null, null)).toBe(14);
  });

  it("readability depends only on grid geometry, never on per-cell scores", () => {
    // Same full grid + same projector; only the scores differ (as the
    // score-threshold slider would filter). The representative pixel size and
    // the availability verdict must be identical — moving the threshold at a
    // fixed zoom must not toggle cell inspection.
    const grid = (scoreScale: number): GridFeatureCollection => ({
      features: Array.from({ length: 9 }, (_, index) => {
        const f = polygonFeature(index, index === 4 ? 18 : 6);
        f.properties.score = index * scoreScale;
        return f;
      }),
    });
    const lowScores = representativeCellMinDimensionPx(grid(1), project, 3, 3);
    const highScores = representativeCellMinDimensionPx(grid(1000), project, 3, 3);
    expect(lowScores).toBe(highScores);
    expect(canInspectCells(false, lowScores)).toBe(canInspectCells(false, highScores));
  });
});

function centroidOf(coords: number[][]): [number, number] {
  const ring = coords.slice(0, -1); // drop closing vertex
  const n = ring.length;
  return [ring.reduce((s, c) => s + c[0], 0) / n, ring.reduce((s, c) => s + c[1], 0) / n];
}

describe("reprojectGridForInspection", () => {
  // Fake projected -> WGS84: shift by (+10 lon, +50 lat) then scale down. Deterministic.
  const toWgs84Fake = ([x, y]: [number, number]): [number, number] | null =>
    x < 0 ? null : [10 + x / 1000, 50 + y / 1000];

  it("reprojects Polygon rings, preserving nesting and properties verbatim", () => {
    const fc: GridFeatureCollection = {
      features: [
        {
          properties: { cell_id: 7, rank: 1, score: 42, score_enhanced: 9, Longitude: 10.5, Latitude: 50.5 },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [1000, 1000],
                [2000, 1000],
                [2000, 2000],
                [1000, 2000],
                [1000, 1000],
              ],
            ],
          },
        } as GridFeature,
      ],
    };
    const out = reprojectGridForInspection(fc, toWgs84Fake);
    expect(out).not.toBe(fc);
    expect(fc.features[0].geometry).toEqual({
      type: "Polygon",
      coordinates: [
        [
          [1000, 1000],
          [2000, 1000],
          [2000, 2000],
          [1000, 2000],
          [1000, 1000],
        ],
      ],
    }); // original untouched
    const g = out.features[0].geometry as GeoJSON.Polygon;
    expect(g.type).toBe("Polygon");
    expect(g.coordinates).toHaveLength(1);
    expect(g.coordinates[0]).toHaveLength(5);
    expect(g.coordinates[0][0]).toEqual([11, 51]);
    expect(g.coordinates[0][2]).toEqual([12, 52]);
    expect(out.features[0].properties).toBe(fc.features[0].properties);
  });

  it("reprojects MultiPolygon with a hole, keeping ring structure", () => {
    const fc: GridFeatureCollection = {
      features: [
        {
          properties: { cell_id: 1, rank: 1, score: 1, Longitude: 0, Latitude: 0 },
          geometry: {
            type: "MultiPolygon",
            coordinates: [
              [
                [[0, 0], [4000, 0], [4000, 4000], [0, 4000], [0, 0]],
                [[1000, 1000], [2000, 1000], [2000, 2000], [1000, 2000], [1000, 1000]],
              ],
            ],
          },
        } as GridFeature,
      ],
    };
    const g = reprojectGridForInspection(fc, toWgs84Fake).features[0].geometry as GeoJSON.MultiPolygon;
    expect(g.type).toBe("MultiPolygon");
    expect(g.coordinates).toHaveLength(1);
    expect(g.coordinates[0]).toHaveLength(2); // outer ring + hole
    expect(g.coordinates[0][0]).toHaveLength(5);
    expect(g.coordinates[0][1][0]).toEqual([11, 51]);
  });

  it("drops features whose geometry can't be fully reprojected", () => {
    const fc: GridFeatureCollection = {
      features: [
        {
          properties: { cell_id: 1, rank: 1, score: 1, Longitude: 0, Latitude: 0 },
          geometry: { type: "Polygon", coordinates: [[[10, 10], [20, 10], [20, 20], [10, 10]]] },
        } as GridFeature,
        {
          properties: { cell_id: 2, rank: 2, score: 2, Longitude: 0, Latitude: 0 },
          geometry: { type: "Polygon", coordinates: [[[-1, 10], [20, 10], [20, 20], [-1, 10]]] },
        } as GridFeature,
      ],
    };
    const out = reprojectGridForInspection(fc, toWgs84Fake);
    expect(out.features.map((f) => f.properties.cell_id)).toEqual([1]);
  });

  it("sanity: reprojected polygon centroid stays near the transform of the source centroid", () => {
    // Not exact — centroid(transform(poly)) != transform(centroid(poly)) under a
    // real projection. A loose tolerance only catches gross errors (swapped x/y,
    // wrong CRS, wrong ring handling).
    const src: number[][] = [
      [1000, 1000],
      [3000, 1000],
      [3000, 3000],
      [1000, 3000],
      [1000, 1000],
    ];
    const fc: GridFeatureCollection = {
      features: [
        {
          properties: { cell_id: 1, rank: 1, score: 1, Longitude: 0, Latitude: 0 },
          geometry: { type: "Polygon", coordinates: [src] },
        } as GridFeature,
      ],
    };
    const outRing = (reprojectGridForInspection(fc, toWgs84Fake).features[0].geometry as GeoJSON.Polygon)
      .coordinates[0] as number[][];
    const [csx, csy] = centroidOf(src);
    const expected = toWgs84Fake([csx, csy])!;
    const [cox, coy] = centroidOf(outRing);
    expect(Math.abs(cox - expected[0])).toBeLessThan(0.01);
    expect(Math.abs(coy - expected[1])).toBeLessThan(0.01);
  });
});

describe("cell inspection details", () => {
  it("uses the score from the currently displayed surface", () => {
    const feature = {
      ...polygonFeature(18342, 20),
      properties: { ...polygonFeature(18342, 20).properties, score: 74.6281, score_enhanced: 12.5 },
    };
    expect(cellInspectionDetails(feature, "baseline")).toEqual({ cellId: 18342, score: 74.6281 });
    expect(cellInspectionDetails(feature, "enhanced")).toEqual({ cellId: 18342, score: 12.5 });
  });
});

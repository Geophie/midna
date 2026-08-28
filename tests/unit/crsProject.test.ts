import { describe, expect, it } from "vitest";
import { crsIsKnown, isWgs84, normalizeEpsg, toWgs84 } from "@/lib/crsProject";

describe("normalizeEpsg", () => {
  it.each([
    ["EPSG:32616", "EPSG:32616"],
    ["epsg:32616", "EPSG:32616"],
    ["EPSG: 32616", "EPSG:32616"],
    ["32616", "EPSG:32616"],
    ["urn:ogc:def:crs:EPSG::32616", "EPSG:32616"],
    ["WGS84", "EPSG:4326"],
    ["CRS:84", "EPSG:4326"],
    ["  epsg:4326 ", "EPSG:4326"],
  ])("normalizes %s -> %s", (input, expected) => {
    expect(normalizeEpsg(input)).toBe(expected);
  });

  it.each(["", "   ", "garbage", "EPSG:", "not-a-crs"])("rejects %s", (input) => {
    expect(normalizeEpsg(input)).toBeNull();
  });
});

describe("isWgs84 / crsIsKnown", () => {
  it("treats 4326 and its aliases as WGS84", () => {
    expect(isWgs84("EPSG:4326")).toBe(true);
    expect(isWgs84("wgs84")).toBe(true);
    expect(isWgs84("EPSG:32616")).toBe(false);
  });

  it("knows built-in, generated UTM, and curated CRSs", () => {
    expect(crsIsKnown("EPSG:4326")).toBe(true);
    expect(crsIsKnown("EPSG:32616")).toBe(true); // generated WGS84 UTM 16N
    expect(crsIsKnown("EPSG:32724")).toBe(true); // generated WGS84 UTM 24S
    expect(crsIsKnown("EPSG:26916")).toBe(true); // generated NAD83 UTM 16N
    for (const ga of ["EPSG:26766", "EPSG:26767", "EPSG:26966", "EPSG:26967", "EPSG:2239", "EPSG:2240"]) {
      expect(crsIsKnown(ga)).toBe(true); // curated Georgia State Plane
    }
    expect(crsIsKnown("EPSG:99999")).toBe(false);
    expect(crsIsKnown("nonsense")).toBe(false);
  });
});

describe("toWgs84", () => {
  it("is an identity for WGS84 input", () => {
    expect(toWgs84(-84.39, 33.755, "EPSG:4326")).toEqual([-84.39, 33.755]);
  });

  it("reprojects a WGS84 UTM 16N easting/northing to lon/lat", () => {
    const [lon, lat] = toWgs84(741749.84, 3738052.17, "EPSG:32616")!;
    expect(lon).toBeCloseTo(-84.39, 4);
    expect(lat).toBeCloseTo(33.755, 4);
  });

  it("reprojects a NAD27 / Georgia West (US-ft) easting/northing to lon/lat", () => {
    const [lon, lat] = toWgs84(432119.36, 1365941.28, "EPSG:26767")!;
    expect(lon).toBeCloseTo(-84.39, 3);
    expect(lat).toBeCloseTo(33.755, 3);
  });

  it("uses the East-zone central meridian for EPSG:26766 (Atlanta is out of that zone)", () => {
    // Same lon/lat through the East zone lands at a very different easting than 26767.
    const [lon] = toWgs84(-175270.8, 1370959.0, "EPSG:26766")!;
    expect(lon).toBeCloseTo(-84.388, 2);
  });

  it("returns null for an unknown CRS instead of guessing", () => {
    expect(toWgs84(500000, 4000000, "EPSG:99999")).toBeNull();
  });

  it("passes WGS84 input straight through without range-checking (matches prior behaviour)", () => {
    expect(toWgs84(500000, 4000000, "EPSG:4326")).toEqual([500000, 4000000]);
  });

  it("returns null for non-finite input", () => {
    expect(toWgs84(Number.NaN, 10, "EPSG:32616")).toBeNull();
    expect(toWgs84(10, Number.POSITIVE_INFINITY, "EPSG:32616")).toBeNull();
  });
});

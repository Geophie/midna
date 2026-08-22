import { describe, expect, it } from "vitest";
import { parseCrimePoints, parseAnchorPoint, parseGridOutline } from "@/lib/mapPoints";

describe("parseCrimePoints", () => {
  it("parses valid rows in file order", () => {
    const csv = "Latitude,Longitude\n33.75,-84.39\n33.76,-84.38\n";
    const points = parseCrimePoints(csv, "Latitude", "Longitude");
    expect(points).toEqual([
      { lat: 33.75, lon: -84.39 },
      { lat: 33.76, lon: -84.38 },
    ]);
  });

  it("skips invalid rows", () => {
    const csv = "Latitude,Longitude\nabc,-84.39\n33.76,-84.38\n";
    const points = parseCrimePoints(csv, "Latitude", "Longitude");
    expect(points).toEqual([{ lat: 33.76, lon: -84.38 }]);
  });

  it("returns empty for missing columns", () => {
    const csv = "Lat,Lon\n33.75,-84.39\n";
    expect(parseCrimePoints(csv, "Latitude", "Longitude")).toEqual([]);
  });

  it("returns empty for a header-only file", () => {
    expect(parseCrimePoints("Latitude,Longitude\n", "Latitude", "Longitude")).toEqual([]);
  });
});

describe("parseAnchorPoint", () => {
  const enc = (s: string) => new TextEncoder().encode(s);

  it("reads the first data row from a CSV anchor file", () => {
    const csv = "Latitude,Longitude\n40.1,-3.7\n41.2,-4.8\n";
    const point = parseAnchorPoint("anchor.csv", enc(csv), "Latitude", "Longitude");
    expect(point).toEqual({ lat: 40.1, lon: -3.7 });
  });

  it("reads the first feature's Point coordinates from GeoJSON", () => {
    const geojson = JSON.stringify({
      type: "FeatureCollection",
      features: [{ type: "Feature", geometry: { type: "Point", coordinates: [-3.7, 40.1] }, properties: {} }],
    });
    const point = parseAnchorPoint("anchor.geojson", enc(geojson), "Latitude", "Longitude");
    expect(point).toEqual({ lat: 40.1, lon: -3.7 });
  });

  it("reads the first coordinate of a Polygon as an approximation", () => {
    const geojson = JSON.stringify({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Polygon", coordinates: [[[-3.7, 40.1], [-3.8, 40.2], [-3.6, 40.0]]] },
          properties: {},
        },
      ],
    });
    const point = parseAnchorPoint("anchor.geojson", enc(geojson), "Latitude", "Longitude");
    expect(point).toEqual({ lat: 40.1, lon: -3.7 });
  });

  it("returns null for malformed GeoJSON", () => {
    expect(parseAnchorPoint("anchor.geojson", enc("{not json"), "Latitude", "Longitude")).toBeNull();
  });

  it("returns null when a CSV anchor file has no data rows", () => {
    expect(parseAnchorPoint("anchor.csv", enc("Latitude,Longitude\n"), "Latitude", "Longitude")).toBeNull();
  });
});

describe("parseGridOutline", () => {
  it("passes through a valid FeatureCollection", () => {
    const fc = { type: "FeatureCollection", features: [] };
    const result = parseGridOutline(new TextEncoder().encode(JSON.stringify(fc)));
    expect(result).toEqual(fc);
  });

  it("returns null for malformed JSON", () => {
    expect(parseGridOutline(new TextEncoder().encode("{not json"))).toBeNull();
  });
});

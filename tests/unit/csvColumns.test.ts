import { describe, expect, it } from "vitest";
import { resolveCsvCoordinateColumns } from "@/lib/csvColumns";

describe("resolveCsvCoordinateColumns", () => {
  it("keeps exact-case headers", () => {
    expect(resolveCsvCoordinateColumns(["CaseID", "Latitude", "Longitude"], "Latitude", "Longitude")).toEqual({
      latIdx: 1,
      lonIdx: 2,
    });
  });

  it.each([
    ["lowercase", ["CaseID", "latitude", "longitude"]],
    ["uppercase", ["CaseID", "LATITUDE", "LONGITUDE"]],
    ["mixed case", ["CaseID", "latitude", "LONGITUDE"]],
  ])("resolves %s headers", (_name, headers) => {
    expect(resolveCsvCoordinateColumns(headers, "Latitude", "Longitude")).toEqual({ latIdx: 1, lonIdx: 2 });
  });

  it("reports missing columns", () => {
    expect(resolveCsvCoordinateColumns(["Lat", "Lon"], "Latitude", "Longitude")).toEqual({ error: "missing" });
  });

  it("rejects ambiguous case-insensitive headers", () => {
    expect(resolveCsvCoordinateColumns(["Latitude", "latitude", "Longitude"], "Latitude", "Longitude")).toEqual({
      error: "ambiguous",
    });
  });
});

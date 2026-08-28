import { describe, expect, it } from "vitest";
import { preflightCrimesCsv } from "@/lib/csvPreflight";

describe("preflightCrimesCsv", () => {
  it("accepts a well-formed CSV", () => {
    const csv = "Latitude,Longitude\n33.75,-84.39\n33.76,-84.38\n33.74,-84.40\n";
    const result = preflightCrimesCsv(csv, "Latitude", "Longitude");
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.rowCount).toBe(3);
  });

  it("flags missing lat/lon columns", () => {
    const csv = "Lat,Lon\n33.75,-84.39\n33.76,-84.38\n";
    const result = preflightCrimesCsv(csv, "Latitude", "Longitude");
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("error_csv_columns");
  });

  it("flags ambiguous case-insensitive coordinate headers", () => {
    const csv = "Latitude,latitude,Longitude\n33.75,33.75,-84.39\n33.76,33.76,-84.38\n";
    expect(preflightCrimesCsv(csv, "Latitude", "Longitude").errors).toEqual(["error_csv_columns_ambiguous"]);
  });

  it("flags an empty file", () => {
    const result = preflightCrimesCsv("", "Latitude", "Longitude");
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("error_file_empty");
  });

  it("flags a header-only file (no data rows)", () => {
    const csv = "Latitude,Longitude\n";
    const result = preflightCrimesCsv(csv, "Latitude", "Longitude");
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("error_file_empty");
  });

  it("flags non-numeric values", () => {
    const csv = "Latitude,Longitude\nabc,-84.39\n33.76,-84.38\n";
    const result = preflightCrimesCsv(csv, "Latitude", "Longitude");
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("error_col_invalid_values");
  });

  it("flags NaN/Inf-like and empty cells", () => {
    const csv = "Latitude,Longitude\n,-84.39\n33.76,\n";
    const result = preflightCrimesCsv(csv, "Latitude", "Longitude");
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("error_col_invalid_values");
  });

  it("flags fewer than 2 rows", () => {
    const csv = "Latitude,Longitude\n33.75,-84.39\n";
    const result = preflightCrimesCsv(csv, "Latitude", "Longitude");
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("error_too_few_crimes");
  });

  it("flags all-identical points", () => {
    const csv = "Latitude,Longitude\n33.75,-84.39\n33.75,-84.39\n33.75,-84.39\n";
    const result = preflightCrimesCsv(csv, "Latitude", "Longitude");
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("error_crimes_identical");
  });

  it("respects custom column names", () => {
    const csv = "y,x\n1.0,2.0\n3.0,4.0\n";
    const result = preflightCrimesCsv(csv, "y", "x");
    expect(result.ok).toBe(true);
  });
});

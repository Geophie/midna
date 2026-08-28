import { resolveCsvCoordinateColumns } from "@/lib/csvColumns";

export interface CsvPreflightResult {
  ok: boolean;
  errors: string[];
  rowCount: number;
}

function splitCsvLine(line: string): string[] {
  return line.split(",").map((cell) => cell.trim());
}

/**
 * Fast client-side pre-check before spinning up Pyodide. Not a full RFC4180
 * parser (no quoted-field support) — core.aoi.loadCrimesCsv in the worker
 * remains the authoritative parser, same two-layer split as the desktop app.
 */
export function preflightCrimesCsv(
  csvText: string,
  latCol: string,
  lonCol: string
): CsvPreflightResult {
  const lines = csvText.split(/\r\n|\r|\n/).filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { ok: false, errors: ["error_file_empty"], rowCount: 0 };
  }

  const header = splitCsvLine(lines[0]);
  const columns = resolveCsvCoordinateColumns(header, latCol, lonCol);
  if ("error" in columns) {
    return {
      ok: false,
      errors: [columns.error === "ambiguous" ? "error_csv_columns_ambiguous" : "error_csv_columns"],
      rowCount: 0,
    };
  }
  const { latIdx, lonIdx } = columns;

  const dataLines = lines.slice(1);
  if (dataLines.length === 0) {
    return { ok: false, errors: ["error_file_empty"], rowCount: 0 };
  }

  const errors: string[] = [];
  let numericIssues = 0;
  const points = new Set<string>();

  for (const line of dataLines) {
    const cells = splitCsvLine(line);
    const rawLat = cells[latIdx];
    const rawLon = cells[lonIdx];
    const latVal = Number(rawLat);
    const lonVal = Number(rawLon);
    const invalid =
      rawLat === undefined ||
      rawLon === undefined ||
      rawLat === "" ||
      rawLon === "" ||
      Number.isNaN(latVal) ||
      Number.isNaN(lonVal) ||
      !Number.isFinite(latVal) ||
      !Number.isFinite(lonVal);

    if (invalid) {
      numericIssues++;
    } else {
      points.add(`${latVal},${lonVal}`);
    }
  }

  if (numericIssues > 0) {
    errors.push("error_col_invalid_values");
  }
  if (dataLines.length < 2) {
    errors.push("error_too_few_crimes");
  } else if (numericIssues === 0 && points.size < 2) {
    errors.push("error_crimes_identical");
  }

  return { ok: errors.length === 0, errors, rowCount: dataLines.length };
}

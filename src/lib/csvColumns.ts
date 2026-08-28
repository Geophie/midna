export type CsvCoordinateColumns =
  | { latIdx: number; lonIdx: number }
  | { error: "missing" | "ambiguous" };

/** Resolves coordinate headers without changing the uploaded CSV's names. */
export function resolveCsvCoordinateColumns(
  headers: string[],
  latCol: string,
  lonCol: string
): CsvCoordinateColumns {
  const indexFor = (requested: string): number | "missing" | "ambiguous" => {
    const matches = headers.reduce<number[]>(
      (indices, header, index) =>
        header.toLowerCase() === requested.toLowerCase() ? [...indices, index] : indices,
      []
    );
    return matches.length === 1 ? matches[0] : matches.length === 0 ? "missing" : "ambiguous";
  };

  const latIdx = indexFor(latCol);
  const lonIdx = indexFor(lonCol);
  if (latIdx === "ambiguous" || lonIdx === "ambiguous") return { error: "ambiguous" };
  if (latIdx === "missing" || lonIdx === "missing") return { error: "missing" };
  return { latIdx, lonIdx };
}

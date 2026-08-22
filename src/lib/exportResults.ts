import type { RunResult } from "@/lib/store";

// Standard ESRI-style WGS84 WKT, the same convention GDAL/OGR/QGIS expect in
// a .prj sidecar — no client-side pyproj needed for a fixed EPSG:4326 export.
const WGS84_PRJ_WKT =
  'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]';

interface CellFeatureProps {
  cell_id: number;
  rank: number;
  score: number;
  score_enhanced?: number;
  Longitude: number;
  Latitude: number;
}

interface FeatureCollection {
  features: Array<{ properties: CellFeatureProps }>;
}

export function buildCsvExport(result: RunResult): { csv: string; csvt: string; prj: string } {
  const geoJson = result.enhancedGeoJson ?? result.baselineGeoJson;
  const fc = JSON.parse(geoJson) as FeatureCollection;
  const rows = fc.features.map((f) => f.properties).sort((a, b) => a.rank - b.rank);
  const hasEnhanced = rows.some((r) => r.score_enhanced !== undefined);

  const cols = hasEnhanced
    ? (["cell_id", "rank", "score", "score_enhanced", "Longitude", "Latitude"] as const)
    : (["cell_id", "rank", "score", "Longitude", "Latitude"] as const);

  const typeMap: Record<string, string> = {
    cell_id: "Integer",
    rank: "Integer",
    score: "Real",
    score_enhanced: "Real",
    Longitude: "Real",
    Latitude: "Real",
    WKT: "WKT",
  };

  const header = [...cols, "WKT"].join(",");
  const lines = rows.map((r) => {
    const values = cols.map((c) => String(r[c]));
    const wkt = `"POINT (${r.Longitude} ${r.Latitude})"`;
    return [...values, wkt].join(",");
  });
  const csv = [header, ...lines].join("\n");
  const csvt = [...cols, "WKT"].map((c) => `"${typeMap[c]}"`).join(",");

  return { csv, csvt, prj: WGS84_PRJ_WKT };
}

function downloadText(fileName: string, content: string, mimeType = "text/plain") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportCsv(result: RunResult, baseName = "rossmo_ranking") {
  const { csv, csvt, prj } = buildCsvExport(result);
  downloadText(`${baseName}.csv`, csv, "text/csv");
  downloadText(`${baseName}.csvt`, csvt);
  downloadText(`${baseName}.prj`, prj);
}

export function exportGeoJson(geoJson: string, fileName: string) {
  downloadText(fileName, geoJson, "application/geo+json");
}

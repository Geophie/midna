"use client";

import { useMemo, useState } from "react";
import { useAppStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { parseGridFeatureCollection, type GridFeatureProps } from "@/lib/geoResult";

const ROW_COUNT_OPTIONS = [1, 5, 10, 15, 20, 25, 50, 100] as const;

function parseTopCells(geoJson: string, limit: number): GridFeatureProps[] {
  const fc = parseGridFeatureCollection(geoJson);
  return fc.features
    .map((f) => f.properties)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit);
}

export function ResultsPanel() {
  const t = useT();
  const status = useAppStore((s) => s.status);
  const result = useAppStore((s) => s.result);
  const errorMessage = useAppStore((s) => s.errorMessage);
  const view = useAppStore((s) => s.heatmapView);
  const setView = useAppStore((s) => s.setHeatmapView);
  const [limit, setLimit] = useState<number>(15);

  const hasEnhanced = Boolean(result?.enhancedGeoJson);
  const activeView = view === "enhanced" && hasEnhanced ? "enhanced" : "baseline";

  const topCells = useMemo(() => {
    if (!result) return [];
    const geoJson = activeView === "enhanced" ? result.enhancedGeoJson : result.baselineGeoJson;
    return geoJson ? parseTopCells(geoJson, limit) : [];
  }, [result, activeView, limit]);

  if (status === "error") {
    const label = errorMessage ? t(errorMessage) : "";
    return <p className="text-sm text-red-600 dark:text-red-400">{t("error_prefix", { label })}</p>;
  }

  if (!result) {
    return <p className="text-sm text-foreground-muted">{t("no_result_yet")}</p>;
  }

  const scoreKey = activeView === "enhanced" ? "score_enhanced" : "score";
  const outliersClause =
    result.outliersRemoved > 0
      ? t("results_outliers_clause", { removed: result.outliersRemoved, total: result.nCrimesTotal })
      : "";

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-foreground-muted">
        {t("results_summary", {
          crimes: result.nCrimes,
          outliersClause,
          cells: result.nCells,
          b: result.b.toFixed(4),
        })}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        {hasEnhanced && (
          <div className="flex gap-1 rounded-full border border-border bg-background p-1 self-start">
            {(["baseline", "enhanced"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  activeView === v
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground-muted hover:text-foreground"
                }`}
              >
                {v === "baseline" ? t("model_baseline_label") : t("model_enhanced_label")}
              </button>
            ))}
          </div>
        )}
        <label className="flex items-center gap-2 text-xs text-foreground-muted">
          {t("rows_label")}
          <select
            className="rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            {ROW_COUNT_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-border bg-background text-left text-foreground-muted">
              <th className="px-3 py-2 font-medium">{t("table_col_rank")}</th>
              <th className="px-3 py-2 font-medium">{t("table_col_cell_id")}</th>
              <th className="px-3 py-2 font-medium">{t("table_col_score")}</th>
              <th className="px-3 py-2 font-medium">{t("table_col_lon")}</th>
              <th className="px-3 py-2 font-medium">{t("table_col_lat")}</th>
            </tr>
          </thead>
          <tbody>
            {topCells.map((cell) => (
              <tr key={cell.cell_id} className="border-b border-border last:border-0">
                <td className="px-3 py-1.5">{cell.rank}</td>
                <td className="px-3 py-1.5">{cell.cell_id}</td>
                <td className="px-3 py-1.5">
                  {(scoreKey === "score_enhanced" ? cell.score_enhanced : cell.score)?.toFixed(2)}
                </td>
                <td className="px-3 py-1.5">{cell.Longitude.toFixed(5)}</td>
                <td className="px-3 py-1.5">{cell.Latitude.toFixed(5)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

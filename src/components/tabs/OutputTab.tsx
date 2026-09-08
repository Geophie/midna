"use client";

import { useMemo } from "react";

import { Card } from "@/components/ui/Card";
import { ResultsPanel } from "@/components/ResultsPanel";
import { EvalSummary } from "@/components/EvalSummary";
import { LorenzChart } from "@/components/LorenzChart";
import { ExecutionLog } from "@/components/ExecutionLog";
import { useAppStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { Legend } from "@/components/MapPanel/Legend";
import { computeLegendBands, parseGridFeatureCollection, scoreKeyForView } from "@/lib/geoResult";

export function OutputTab() {
  const t = useT();
  const result = useAppStore((s) => s.result);
  const heatmapView = useAppStore((s) => s.heatmapView);
  const legendVisible = useAppStore((s) => s.legendVisible);
  const heatmapVisible = useAppStore((s) => s.layerVisibility.heatmap);
  const lorenzExpanded = useAppStore((s) => s.lorenzExpanded);
  const setLorenzExpanded = useAppStore((s) => s.setLorenzExpanded);
  const activeView = heatmapView === "enhanced" && result?.enhancedGeoJson ? "enhanced" : "baseline";
  const legendBands = useMemo(() => {
    if (!result || !legendVisible || !heatmapVisible) return [];
    const geoJson = activeView === "enhanced" ? result.enhancedGeoJson : result.baselineGeoJson;
    return geoJson ? computeLegendBands(parseGridFeatureCollection(geoJson), scoreKeyForView(activeView)) : [];
  }, [activeView, heatmapVisible, legendVisible, result]);

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-1">
        <h2 className="text-base font-medium">{t("result_grid_info")}</h2>
        <p className="text-sm text-foreground-muted">
          {t("grid_cells_created", { n: result ? result.nCells : "—" })}
        </p>
      </Card>

      <Card className="flex flex-col gap-3">
        {/* Both cards render the same row set so matching metrics line up
            horizontally across baseline and enhanced. */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <EvalSummary
            label={t("result_baseline")}
            gini={result?.baselineGini ?? null}
            evalResult={result?.baselineEval ?? null}
            showEligible
          />
          <EvalSummary
            label={t("result_enhanced")}
            gini={result?.enhancedGini ?? null}
            evalResult={result?.enhancedEval ?? null}
            showEligible
          />
        </div>
        <p className="text-xs text-foreground-muted">{t("eval_eligible_help")}</p>
      </Card>

      <Card>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-medium">{t("lorenz_charts_title")}</h2>
          <button
            type="button"
            onClick={() => setLorenzExpanded(!lorenzExpanded)}
            aria-label={lorenzExpanded ? t("lorenz_collapse") : t("lorenz_expand")}
            title={lorenzExpanded ? t("lorenz_collapse") : t("lorenz_expand")}
            className="hidden h-8 w-8 items-center justify-center rounded-full border border-border bg-background-elevated text-foreground-muted transition-colors hover:text-foreground sm:flex"
          >
            {lorenzExpanded ? "−" : "+"}
          </button>
        </div>
        <div className={`grid grid-cols-1 gap-6 ${lorenzExpanded ? "" : "sm:grid-cols-2"}`}>
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">{t("lorenz_baseline_title")}</h3>
            <LorenzChart curve={result?.baselineLorenz ?? null} label={t("model_baseline_label")} color="var(--accent)" />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">{t("lorenz_enhanced_title")}</h3>
            <LorenzChart curve={result?.enhancedLorenz ?? null} label={t("model_enhanced_label")} color="#22c55e" />
          </div>
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-base font-medium">{t("results_table_title")}</h2>
        <ResultsPanel />
      </Card>

      {legendBands.length > 0 && (
        <Card className="flex flex-col gap-3">
          <h2 className="text-base font-medium">{t("legend_toggle_label")}</h2>
          <div className="max-w-full overflow-x-auto">
            <Legend bands={legendBands} />
          </div>
        </Card>
      )}

      <Card className="flex flex-col gap-3">
        <h2 className="text-base font-medium">{t("log_section")}</h2>
        <ExecutionLog />
      </Card>
    </div>
  );
}

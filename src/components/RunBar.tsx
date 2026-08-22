"use client";

import { Card } from "@/components/ui/Card";
import { useAppStore, type RunStatus } from "@/lib/store";
import { exportCsv, exportGeoJson } from "@/lib/exportResults";
import { useT } from "@/lib/i18n";

export function RunBar({
  status,
  progressFrac,
  progressStage,
  canRun,
  onRun,
  onStop,
}: {
  status: RunStatus;
  progressFrac: number;
  progressStage: string;
  canRun: boolean;
  onRun: () => void;
  onStop: () => void;
}) {
  const t = useT();
  const isBusy = status === "running" || status === "loading-engine" || status === "cancelling";
  const result = useAppStore((s) => s.result);

  return (
    <Card className="mb-6 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!canRun}
          onClick={onRun}
          className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-foreground transition-opacity disabled:opacity-40"
        >
          {t("btn_run")}
        </button>
        <button
          type="button"
          disabled={status !== "running" && status !== "loading-engine"}
          onClick={onStop}
          className="rounded-full border border-border px-5 py-2 text-sm font-medium text-foreground transition-opacity disabled:opacity-40"
        >
          {t("btn_stop")}
        </button>
        {status === "done" && result && (
          <>
            <button
              type="button"
              onClick={() => exportCsv(result)}
              className="rounded-full border border-border px-4 py-2 text-sm text-foreground transition-opacity"
            >
              {t("btn_export_csv")}
            </button>
            <button
              type="button"
              onClick={() => exportGeoJson(result.baselineGeoJson, "rossmo_baseline.geojson")}
              className="rounded-full border border-border px-4 py-2 text-sm text-foreground transition-opacity"
            >
              {t("btn_export_baseline_geojson")}
            </button>
            {result.enhancedGeoJson && (
              <button
                type="button"
                onClick={() => exportGeoJson(result.enhancedGeoJson!, "rossmo_enhanced.geojson")}
                className="rounded-full border border-border px-4 py-2 text-sm text-foreground transition-opacity"
              >
                {t("btn_export_enhanced_geojson")}
              </button>
            )}
          </>
        )}
        {status === "cancelled" && <span className="text-sm text-foreground-muted">{t("run_cancelled")}</span>}
      </div>
      {isBusy && (
        <div className="flex flex-col gap-1.5">
          <div className="h-2 w-full overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${Math.round(progressFrac * 100)}%` }}
            />
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-sm font-semibold text-foreground">{Math.round(progressFrac * 100)}%</span>
            <p className="text-xs text-foreground-muted">
              {status === "loading-engine" ? t("loading_engine") : t(`stage_${progressStage}`)}
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}

"use client";

import type { EvalResult } from "@/workers/pyodide.worker";
import { useT } from "@/lib/i18n";

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-foreground-muted">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export function EvalSummary({
  label,
  gini,
  evalResult,
}: {
  label: string;
  gini: number | null;
  evalResult: EvalResult | null;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">{label}</h3>
      <div className="flex flex-col gap-1">
        <StatRow
          label={t("result_hit_score")}
          value={evalResult ? `${evalResult.hit_score_pct.toFixed(2)}%` : "—"}
        />
        <StatRow
          label={t("result_search_area")}
          value={evalResult ? `${evalResult.search_area_km2.toFixed(2)} km²` : "—"}
        />
        <StatRow label={t("result_gini")} value={gini !== null ? `${(gini * 100).toFixed(2)}%` : "—"} />
        <StatRow
          label={t("result_distance")}
          value={evalResult ? `${(evalResult.home_guess_distance_m / 1000).toFixed(2)} km` : "—"}
        />
      </div>
    </div>
  );
}

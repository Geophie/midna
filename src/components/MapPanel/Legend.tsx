import type { LegendBand } from "@/lib/geoResult";
import { useT } from "@/lib/i18n";

export function Legend({ bands }: { bands: LegendBand[] }) {
  const t = useT();
  if (bands.length === 0) return null;

  return (
    <table className="border-collapse text-[11px] text-foreground-muted">
      <thead>
        <tr className="text-left">
          <th className="px-1.5 py-0.5 font-medium">{t("legend_col_color")}</th>
          <th className="px-1.5 py-0.5 font-medium">{t("legend_col_priority")}</th>
          <th className="px-1.5 py-0.5 font-medium">{t("legend_col_rank")}</th>
          <th className="px-1.5 py-0.5 font-medium">{t("legend_col_hit_score")}</th>
          <th className="px-1.5 py-0.5 font-medium">{t("legend_col_z_score")}</th>
          <th className="px-1.5 py-0.5 font-medium">{t("legend_col_actual")}</th>
        </tr>
      </thead>
      <tbody>
        {bands.map((band) => (
          <tr key={band.rank}>
            <td className="px-1.5 py-0.5">
              <span className="block h-3 w-4 rounded-sm" style={{ background: band.color }} />
            </td>
            <td className="px-1.5 py-0.5 tabular-nums">{band.priorityPct.toFixed(1)}%</td>
            <td className="px-1.5 py-0.5 tabular-nums">{band.rank}</td>
            <td className="px-1.5 py-0.5 tabular-nums">{band.hitScorePct.toFixed(2)}%</td>
            <td className="px-1.5 py-0.5 tabular-nums">
              {band.zScore >= 0 ? "+" : ""}
              {band.zScore.toFixed(2)}
            </td>
            <td className="px-1.5 py-0.5 tabular-nums">{band.actual.toFixed(3)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

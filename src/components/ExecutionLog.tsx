"use client";

import { useAppStore } from "@/lib/store";
import { useT } from "@/lib/i18n";

export function ExecutionLog() {
  const t = useT();
  const logEntries = useAppStore((s) => s.logEntries);

  if (logEntries.length === 0) return null;

  const t0 = logEntries[0].t;

  return (
    <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-lg border border-border bg-background p-2 font-mono text-xs">
      {logEntries.map((entry, i) => (
        <div key={i} className="flex justify-between gap-3 text-foreground-muted">
          <span>
            [{((entry.t - t0) / 1000).toFixed(1)}s] {t(`stage_${entry.stage}`)}
          </span>
          <span>{Math.round(entry.frac * 100)}%</span>
        </div>
      ))}
    </div>
  );
}

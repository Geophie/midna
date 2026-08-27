"use client";

import dynamic from "next/dynamic";
import { useAppStore } from "@/lib/store";
import { useT } from "@/lib/i18n";

function MapLoading() {
  const t = useT();
  return (
    <div className="flex h-full w-full items-center justify-center bg-background-elevated text-sm text-foreground-muted">
      {t("map_loading")}
    </div>
  );
}

const MapView = dynamic(() => import("./MapView").then((m) => m.MapView), {
  ssr: false,
  loading: () => <MapLoading />,
});

export function MapPanel() {
  const heatmapView = useAppStore((s) => s.heatmapView);
  const hasEnhanced = Boolean(useAppStore((s) => s.result?.enhancedGeoJson));
  const activeView = heatmapView === "enhanced" && hasEnhanced ? "enhanced" : "baseline";

  return (
    <div className="relative h-full min-h-[320px] w-full overflow-hidden rounded-2xl border border-border bg-background-elevated shadow-sm">
      <MapView activeView={activeView} />
    </div>
  );
}

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
    <div className="relative h-full max-h-full w-full max-w-full min-w-[360px] min-h-[320px] resize overflow-hidden bg-background-elevated">
      <MapView activeView={activeView} />
    </div>
  );
}

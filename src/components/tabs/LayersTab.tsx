"use client";

import { Card } from "@/components/ui/Card";
import { LayerCard } from "@/components/LayerCard";
import { useAppStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import type { DemLayerSpec, VectorLayerSpec } from "@/workers/pyodide.worker";

function newDemLayer(): DemLayerSpec {
  return {
    type: "dem",
    name: "DEM",
    fileName: "",
    fileBytes: new Uint8Array(),
    enabled: true,
    pianuraMin: 0,
    collinaMin: 220,
    montagnaMin: 350,
    lowWeight: 0,
    midWeight: 0,
    highWeight: 0,
    nodataWeight: 0,
  };
}

function newVectorLayer(type: "inclusion" | "exclusion", name: string): VectorLayerSpec {
  return {
    type,
    name,
    files: [],
    enabled: true,
    intersectWeight: type === "inclusion" ? 1.0 : 0.0,
    noIntersectWeight: type === "inclusion" ? 0.0 : 1.0,
  };
}

export function LayersTab() {
  const t = useT();
  const layers = useAppStore((s) => s.layers);
  const addLayer = useAppStore((s) => s.addLayer);
  const hasDem = layers.some((l) => l.layer.type === "dem");

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium">{t("add_layer_label")}</span>
        <button
          type="button"
          disabled={hasDem}
          onClick={() => addLayer(newDemLayer())}
          className="rounded-full border border-border px-4 py-1.5 text-sm disabled:opacity-40"
          title={hasDem ? t("warning_single_dem") : undefined}
        >
          {t("layer_type_dem")}
        </button>
        <button
          type="button"
          onClick={() => addLayer(newVectorLayer("inclusion", t("layer_type_inclusion")))}
          className="rounded-full border border-border px-4 py-1.5 text-sm"
        >
          {t("layer_type_inclusion")}
        </button>
        <button
          type="button"
          onClick={() => addLayer(newVectorLayer("exclusion", t("layer_type_exclusion")))}
          className="rounded-full border border-border px-4 py-1.5 text-sm"
        >
          {t("layer_type_exclusion")}
        </button>
      </Card>

      {layers.length === 0 && (
        <Card>
          <p className="text-sm text-foreground-muted">{t("no_layers_message")}</p>
        </Card>
      )}

      {layers.map((entry) => (
        <LayerCard key={entry.id} entry={entry} />
      ))}
    </div>
  );
}

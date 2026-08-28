"use client";

import * as Comlink from "comlink";
import { useCallback, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { RunBar } from "@/components/RunBar";
import { InputTab } from "@/components/tabs/InputTab";
import { ParametriTab } from "@/components/tabs/ParametriTab";
import { LayersTab } from "@/components/tabs/LayersTab";
import { OutputTab } from "@/components/tabs/OutputTab";
import { HelpTab } from "@/components/tabs/HelpTab";
import type { TabDef } from "@/components/ui/TabNav";
import { getPyodideApi } from "@/lib/pyodideClient";
import { paramsSchema } from "@/lib/paramsSchema";
import { useT } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { MapPanel } from "@/components/MapPanel/MapPanel";
import { startLongTaskObserver } from "@/lib/longTaskObserver";
import { getPayload } from "@/lib/binaryPayloadStore";

export default function Home() {
  useEffect(() => {
    startLongTaskObserver();
  }, []);

  const t = useT();
  const TABS: TabDef[] = [
    { id: "input", label: t("tab_input") },
    { id: "parametri", label: t("tab_params") },
    { id: "layers", label: t("tab_layers") },
    { id: "output", label: t("tab_output") },
    { id: "help", label: t("tab_help") },
  ];

  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const csvText = useAppStore((s) => s.csvText);
  const params = useAppStore((s) => s.params);
  const layers = useAppStore((s) => s.layers);
  const anchorFileName = useAppStore((s) => s.anchorFileName);
  const anchorFileBytes = useAppStore((s) => s.anchorFileBytes);
  const gridFileName = useAppStore((s) => s.gridFileName);
  const gridFileBytes = useAppStore((s) => s.gridFileBytes);
  const status = useAppStore((s) => s.status);
  const progressFrac = useAppStore((s) => s.progressFrac);
  const progressStage = useAppStore((s) => s.progressStage);
  const setStatus = useAppStore((s) => s.setStatus);
  const setProgress = useAppStore((s) => s.setProgress);
  const appendLog = useAppStore((s) => s.appendLog);
  const setResult = useAppStore((s) => s.setResult);
  const setCancelled = useAppStore((s) => s.setCancelled);
  const setError = useAppStore((s) => s.setError);
  const reset = useAppStore((s) => s.reset);
  const mapPanelVisible = useAppStore((s) => s.mapPanelVisible);
  const setMapPanelVisible = useAppStore((s) => s.setMapPanelVisible);

  const isBusy = status === "running" || status === "loading-engine" || status === "cancelling";
  const canRun = Boolean(csvText) && !isBusy;

  const handleRun = useCallback(async () => {
    if (!csvText) return;

    const parsedParams = paramsSchema.safeParse(params);
    if (!parsedParams.success) {
      const code = parsedParams.error.issues[0]?.message ?? "";
      alert(t(code));
      return;
    }

    reset();
    setStatus("loading-engine");

    const api = getPyodideApi();
    try {
      const onProgress = Comlink.proxy((frac: number, stage: string) => {
        setStatus("running");
        setProgress(frac, stage);
        appendLog(stage, frac);
      });

      const validLayers = layers
        .map((l) => (l.layer.type === "dem" ? { ...l.layer, fileBytes: getPayload(l.id) } : l.layer))
        .filter((l) => l.enabled && (l.type === "dem" ? l.fileBytes.length > 0 : l.files.length > 0));

      console.log("[run] params", params);
      console.log("[run] layers", validLayers);

      const anchorValid =
        params.anchorLat !== null &&
        params.anchorLon !== null &&
        params.anchorLat >= -90 &&
        params.anchorLat <= 90 &&
        params.anchorLon >= -180 &&
        params.anchorLon <= 180;

      const outcome = await api.runAnalysis(
        {
          crimesCsvText: csvText,
          latCol: params.latCol,
          lonCol: params.lonCol,
          inputCrs: params.inputCrs,
          analysisCrs: params.analysisCrs,
          cellsX: params.cellsX,
          cellsY: params.cellsY,
          aoiPaddingPct: params.aoiPaddingPct,
          f: params.f,
          g: params.g,
          k: params.k,
          bAuto: params.bAuto,
          bValue: params.bValue,
          engine: params.engine,
          useOutliers: params.useOutliers,
          outlierThresholdMultiplier: params.outlierThresholdMultiplier,
          useNormalize: params.useNormalize,
          useGini: params.useGini,
          anchorMode: params.anchorMode,
          anchorFileName: anchorFileName ?? "",
          anchorFileBytes: anchorFileBytes ?? new Uint8Array(),
          anchorLat: anchorValid ? params.anchorLat : null,
          anchorLon: anchorValid ? params.anchorLon : null,
          gridFileName: gridFileName ?? "",
          gridFileBytes: gridFileBytes ?? new Uint8Array(),
          layers: validLayers,
        },
        onProgress
      );
      if (outcome.status === "cancelled") {
        setCancelled();
      } else {
        setResult(outcome, params.analysisCrs);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [
    csvText,
    params,
    layers,
    anchorFileName,
    anchorFileBytes,
    gridFileName,
    gridFileBytes,
    reset,
    setStatus,
    setProgress,
    appendLog,
    setResult,
    setCancelled,
    setError,
    t,
  ]);

  const handleStop = useCallback(async () => {
    setStatus("cancelling");
    const api = getPyodideApi();
    await api.requestCancel();
  }, [setStatus]);

  return (
    <AppShell
      tabs={TABS}
      activeTab={activeTab}
      onTabChange={(id) => setActiveTab(id as typeof activeTab)}
      mapPanelVisible={mapPanelVisible}
      onMapPanelVisibleChange={setMapPanelVisible}
      mapPanel={<MapPanel />}
    >
      <RunBar
        status={status}
        progressFrac={progressFrac}
        progressStage={progressStage}
        canRun={canRun}
        onRun={handleRun}
        onStop={handleStop}
      />
      {activeTab === "input" && <InputTab />}
      {activeTab === "parametri" && <ParametriTab />}
      {activeTab === "layers" && <LayersTab />}
      {activeTab === "output" && <OutputTab />}
      {activeTab === "help" && <HelpTab />}
    </AppShell>
  );
}

import { create } from "zustand";
import type { LayerSpec, RunOutcome } from "@/workers/pyodide.worker";
import type { HeatmapView } from "@/lib/geoResult";

export type RunResult = Extract<RunOutcome, { status: "done" }>;

export type Lang = "it" | "en";

export interface LayerVisibility {
  crimes: boolean;
  anchor: boolean;
  grid: boolean;
  heatmap: boolean;
}

const DEFAULT_LAYER_VISIBILITY: LayerVisibility = {
  crimes: true,
  anchor: true,
  grid: true,
  heatmap: true,
};

export interface ScoreThreshold {
  baseline: number;
  enhanced: number;
}

const DEFAULT_SCORE_THRESHOLD: ScoreThreshold = {
  baseline: 0,
  enhanced: 0,
};

export type RunStatus =
  | "idle"
  | "loading-engine"
  | "running"
  | "cancelling"
  | "cancelled"
  | "done"
  | "error";

export interface AnalysisParams {
  latCol: string;
  lonCol: string;
  inputCrs: string;
  analysisCrs: string;
  cellsX: number;
  cellsY: number;
  // Outer bounding-box padding as a percentage per side.
  // Ignored when a custom grid is loaded.
  aoiPaddingPct: number;
  f: number;
  g: number;
  k: number;
  bAuto: boolean;
  bValue: number;
  engine: "numpy" | "loop";
  useOutliers: boolean;
  outlierThresholdMultiplier: number;
  useNormalize: boolean;
  useGini: boolean;
  anchorMode: "file" | "manual";
  anchorLat: number | null;
  anchorLon: number | null;
}

export const DEFAULT_PARAMS: AnalysisParams = {
  latCol: "Latitude",
  lonCol: "Longitude",
  inputCrs: "EPSG:4326",
  analysisCrs: "EPSG:4326",
  cellsX: 200,
  cellsY: 200,
  aoiPaddingPct: 10,
  f: 1.2,
  g: 1.2,
  k: 1.0,
  bAuto: true,
  bValue: 0,
  engine: "numpy",
  useOutliers: false,
  outlierThresholdMultiplier: 2.0,
  useNormalize: true,
  useGini: true,
  anchorMode: "file",
  anchorLat: null,
  anchorLon: null,
};

export interface LayerEntry {
  id: string;
  layer: LayerSpec;
}

export const TAB_IDS = ["input", "parametri", "layers", "output", "help"] as const;
export type TabId = (typeof TAB_IDS)[number];

interface AppState {
  activeTab: TabId;
  csvText: string | null;
  csvFileName: string | null;
  anchorFileName: string | null;
  anchorFileBytes: Uint8Array | null;
  gridFileName: string | null;
  gridFileBytes: Uint8Array | null;
  params: AnalysisParams;
  layers: LayerEntry[];
  status: RunStatus;
  progressFrac: number;
  progressStage: string;
  logEntries: { stage: string; frac: number; t: number }[];
  result: RunResult | null;
  resultAnalysisCrs: string | null;
  errorMessage: string | null;
  mapPanelVisible: boolean;
  heatmapView: HeatmapView;
  heatmapOpacity: number;
  layerVisibility: LayerVisibility;
  lorenzExpanded: boolean;
  lang: Lang;
  scoreThreshold: ScoreThreshold;
  legendVisible: boolean;
  contouringEnabled: boolean;

  setActiveTab: (tab: TabId) => void;
  setCsv: (fileName: string, text: string) => void;
  clearCsv: () => void;
  setAnchorFile: (fileName: string, bytes: Uint8Array) => void;
  clearAnchorFile: () => void;
  setGridFile: (fileName: string, bytes: Uint8Array) => void;
  clearGridFile: () => void;
  setParams: (patch: Partial<AnalysisParams>) => void;
  addLayer: (layer: LayerSpec) => void;
  removeLayer: (id: string) => void;
  updateLayer: (id: string, patch: Partial<LayerSpec>) => void;
  setStatus: (status: RunStatus) => void;
  setProgress: (frac: number, stage: string) => void;
  appendLog: (stage: string, frac: number) => void;
  setResult: (result: RunResult, analysisCrs: string) => void;
  setCancelled: () => void;
  setError: (message: string) => void;
  setMapPanelVisible: (visible: boolean) => void;
  setHeatmapView: (view: HeatmapView) => void;
  setHeatmapOpacity: (opacity: number) => void;
  setLayerVisible: (key: keyof LayerVisibility, visible: boolean) => void;
  setLorenzExpanded: (expanded: boolean) => void;
  setLang: (lang: Lang) => void;
  setScoreThreshold: (view: HeatmapView, value: number) => void;
  setLegendVisible: (visible: boolean) => void;
  setContouringEnabled: (enabled: boolean) => void;
  reset: () => void;
}

let nextLayerId = 0;

export const useAppStore = create<AppState>((set) => ({
  activeTab: "input",
  csvText: null,
  csvFileName: null,
  anchorFileName: null,
  anchorFileBytes: null,
  gridFileName: null,
  gridFileBytes: null,
  params: DEFAULT_PARAMS,
  layers: [],
  status: "idle",
  progressFrac: 0,
  progressStage: "",
  logEntries: [],
  result: null,
  resultAnalysisCrs: null,
  errorMessage: null,
  mapPanelVisible: true,
  heatmapView: "baseline",
  heatmapOpacity: 0.7,
  layerVisibility: DEFAULT_LAYER_VISIBILITY,
  lorenzExpanded: false,
  lang: "en",
  scoreThreshold: DEFAULT_SCORE_THRESHOLD,
  legendVisible: true,
  contouringEnabled: false,

  setActiveTab: (activeTab) => set({ activeTab }),
  setCsv: (fileName, text) => set({ csvFileName: fileName, csvText: text }),
  clearCsv: () => set({ csvFileName: null, csvText: null }),
  setAnchorFile: (fileName, bytes) => set({ anchorFileName: fileName, anchorFileBytes: bytes }),
  clearAnchorFile: () => set({ anchorFileName: null, anchorFileBytes: null }),
  setGridFile: (fileName, bytes) => set({ gridFileName: fileName, gridFileBytes: bytes }),
  clearGridFile: () => set({ gridFileName: null, gridFileBytes: null }),
  setParams: (patch) => set((s) => ({ params: { ...s.params, ...patch } })),
  addLayer: (layer) =>
    set((s) => ({ layers: [...s.layers, { id: String(nextLayerId++), layer }] })),
  removeLayer: (id) => set((s) => ({ layers: s.layers.filter((l) => l.id !== id) })),
  updateLayer: (id, patch) =>
    set((s) => ({
      layers: s.layers.map((l) =>
        l.id === id ? { id, layer: { ...l.layer, ...patch } as LayerSpec } : l
      ),
    })),
  setStatus: (status) => set({ status }),
  setProgress: (progressFrac, progressStage) => set({ progressFrac, progressStage }),
  appendLog: (stage, frac) =>
    set((s) => ({ logEntries: [...s.logEntries, { stage, frac, t: Date.now() }] })),
  setResult: (result, analysisCrs) =>
    set({
      result,
      resultAnalysisCrs: analysisCrs,
      status: "done",
      progressFrac: 1,
      activeTab: "output",
      contouringEnabled: result.cellsX !== null && result.cellsY !== null,
    }),
  setCancelled: () => set({ status: "cancelled" }),
  setError: (errorMessage) => set({ errorMessage, status: "error" }),
  setMapPanelVisible: (mapPanelVisible) => set({ mapPanelVisible }),
  setHeatmapView: (heatmapView) => set({ heatmapView }),
  setHeatmapOpacity: (heatmapOpacity) => set({ heatmapOpacity }),
  setLayerVisible: (key, visible) =>
    set((s) => ({ layerVisibility: { ...s.layerVisibility, [key]: visible } })),
  setLorenzExpanded: (lorenzExpanded) => set({ lorenzExpanded }),
  setLang: (lang) => set({ lang }),
  setScoreThreshold: (view, value) =>
    set((s) => ({ scoreThreshold: { ...s.scoreThreshold, [view]: value } })),
  setLegendVisible: (legendVisible) => set({ legendVisible }),
  setContouringEnabled: (contouringEnabled) => set({ contouringEnabled }),
  reset: () =>
    set({
      status: "idle",
      progressFrac: 0,
      progressStage: "",
      logEntries: [],
      result: null,
      resultAnalysisCrs: null,
      errorMessage: null,
      heatmapView: "baseline",
      scoreThreshold: DEFAULT_SCORE_THRESHOLD,
      contouringEnabled: false,
    }),
}));

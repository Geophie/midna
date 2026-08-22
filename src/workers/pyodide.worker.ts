/// <reference lib="webworker" />
import * as Comlink from "comlink";

interface PyodideFS {
  mkdirTree(path: string): void;
  writeFile(path: string, data: string | Uint8Array): void;
}

interface PyProxy {
  get(name: string): PyProxy;
  copy(): PyProxy;
  destroy(): void;
  toJs(options?: { dict_converter?: (entries: Iterable<[unknown, unknown]>) => unknown }): unknown;
  (...args: unknown[]): Promise<PyProxy>;
  [attr: string]: unknown;
}

interface PyodideInterface {
  FS: PyodideFS;
  globals: PyProxy;
  loadPackage(names: string[]): Promise<void>;
  runPythonAsync(code: string): Promise<unknown>;
  toPy(obj: unknown): PyProxy;
}

const CORE_FILES = [
  "aoi.py",
  "buffer_zone.py",
  "grid.py",
  "outliers.py",
  "rossmo_numpy.py",
  "rossmo_loop.py",
  "weights.py",
  "normalize.py",
  "ranking.py",
  "evaluation.py",
  "stats.py",
] as const;

interface PyodideEngine {
  pyodide: PyodideInterface;
  runFn: PyProxy;
}

let engineReadyPromise: Promise<PyodideEngine> | null = null;
let cancelRequested = false;

const PYODIDE_MODULE_URL = "/pyodide/pyodide.mjs";

async function initPyodide(): Promise<PyodideEngine> {
  const { loadPyodide } = (await import(
    /* webpackIgnore: true */
    /* turbopackIgnore: true */
    PYODIDE_MODULE_URL
  )) as { loadPyodide: (options: { indexURL: string }) => Promise<PyodideInterface> };
  const pyodide = await loadPyodide({ indexURL: "/pyodide/" });
  await pyodide.loadPackage(["numpy", "pandas", "geopandas", "shapely", "rasterio", "fiona"]);

  pyodide.FS.mkdirTree("/core");
  pyodide.FS.mkdirTree("/webcore");

  for (const file of CORE_FILES) {
    const text = await fetch(`/py/core/${file}`).then((r) => r.text());
    pyodide.FS.writeFile(`/core/${file}`, text);
  }
  const pipelineText = await fetch("/py/webcore/pipeline.py").then((r) => r.text());
  pyodide.FS.writeFile("/webcore/pipeline.py", pipelineText);

  await pyodide.runPythonAsync(`
import sys
for p in ("/", "/webcore"):
    if p not in sys.path:
        sys.path.insert(0, p)
import pipeline
`);

  // Looked up once and kept for the worker's lifetime — looking it up fresh
  // per call would mint a new PyProxy every run with nothing destroying it.
  const pipelineModule = pyodide.globals.get("pipeline");
  // .run is a borrowed attribute proxy: destroying pipelineModule would
  // auto-destroy it too, so copy() detaches an independent proxy first.
  const runFn = (pipelineModule.run as PyProxy).copy();
  pipelineModule.destroy();

  return { pyodide, runFn };
}

function getEngine(): Promise<PyodideEngine> {
  if (!engineReadyPromise) {
    engineReadyPromise = initPyodide();
  }
  return engineReadyPromise;
}

export interface DemLayerSpec {
  type: "dem";
  name: string;
  fileName: string;
  fileBytes: Uint8Array;
  enabled: boolean;
  pianuraMin: number;
  collinaMin: number;
  montagnaMin: number;
  lowWeight: number;
  midWeight: number;
  highWeight: number;
  nodataWeight: number;
}

export interface VectorFileEntry {
  name: string;
  bytes: Uint8Array;
}

export interface VectorLayerSpec {
  type: "inclusion" | "exclusion";
  name: string;
  // 1 entry for a GeoJSON or zipped-shapefile pick; 3-5 for a raw shapefile
  // bundle (.shp + its .shx/.dbf/.prj/.cpg sidecars) picked via folder or
  // multi-select — see src/lib/shapefileBundle.ts.
  files: VectorFileEntry[];
  enabled: boolean;
  intersectWeight: number;
  noIntersectWeight: number;
}

export type LayerSpec = DemLayerSpec | VectorLayerSpec;

export interface RunParams {
  crimesCsvText: string;
  latCol: string;
  lonCol: string;
  inputCrs: string;
  analysisCrs: string;
  cellsX: number;
  cellsY: number;
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
  anchorFileName: string;
  anchorFileBytes: Uint8Array;
  anchorLat: number | null;
  anchorLon: number | null;
  gridFileName: string;
  gridFileBytes: Uint8Array;
  layers: LayerSpec[];
}

export interface EvalResult {
  anchor_rank: number;
  n_cells: number;
  hit_score_pct: number;
  anchor_score: number;
  distance_to_nearest_cell_m: number;
  home_guess_distance_m: number;
  n_priority_cells: number;
  search_area_km2: number;
  total_cells: number;
}

export interface LorenzCurve {
  x: number[];
  y: number[];
}

export type RunOutcome =
  | {
      status: "done";
      b: number;
      nCells: number;
      cellsX: number | null;
      cellsY: number | null;
      nCrimes: number;
      nCrimesTotal: number;
      outliersRemoved: number;
      baselineGini: number | null;
      enhancedGini: number | null;
      baselineLorenz: LorenzCurve;
      enhancedLorenz: LorenzCurve | null;
      baselineEval: EvalResult | null;
      enhancedEval: EvalResult | null;
      baselineGeoJson: string;
      enhancedGeoJson: string | null;
    }
  | { status: "cancelled" };

export type ProgressCallback = (frac: number, stage: string) => void;

function layerExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot);
}

const PRIMARY_EXTENSIONS = [".shp", ".geojson", ".json", ".zip"];

function primaryEntry(files: VectorFileEntry[]): VectorFileEntry {
  const primary = files.find((f) => PRIMARY_EXTENSIONS.includes(layerExtension(f.name).toLowerCase()));
  return primary ?? files[0];
}

const api = {
  async warmUp(): Promise<void> {
    await getEngine();
  },

  requestCancel(): void {
    cancelRequested = true;
  },

  async runAnalysis(params: RunParams, onProgress: ProgressCallback): Promise<RunOutcome> {
    cancelRequested = false;
    const { pyodide, runFn } = await getEngine();

    pyodide.FS.writeFile("/input_crimes.csv", params.crimesCsvText);

    let anchorPath: string | null = null;
    if (params.anchorMode === "file" && params.anchorFileBytes.length > 0) {
      anchorPath = `/input_anchor${layerExtension(params.anchorFileName)}`;
      pyodide.FS.writeFile(anchorPath, params.anchorFileBytes);
    }

    let gridPath: string | null = null;
    if (params.gridFileBytes.length > 0) {
      gridPath = `/input_grid${layerExtension(params.gridFileName)}`;
      pyodide.FS.writeFile(gridPath, params.gridFileBytes);
    }

    const pyLayers = params.layers.map((layer, idx) => {
      if (layer.type === "dem") {
        const path = `/input_layer_${idx}${layerExtension(layer.fileName)}`;
        pyodide.FS.writeFile(path, layer.fileBytes);
        return {
          type: "dem",
          name: layer.name,
          path,
          pianuraMin: layer.pianuraMin,
          collinaMin: layer.collinaMin,
          montagnaMin: layer.montagnaMin,
          lowWeight: layer.lowWeight,
          midWeight: layer.midWeight,
          highWeight: layer.highWeight,
          nodataWeight: layer.nodataWeight,
        };
      }

      // Vector layer: write the whole bundle into its own directory so
      // shapefile sidecars sit next to the .shp the way GDAL expects.
      const dir = `/input_layer_${idx}`;
      pyodide.FS.mkdirTree(dir);
      for (const entry of layer.files) {
        pyodide.FS.writeFile(`${dir}/${entry.name}`, entry.bytes);
      }
      const path = `${dir}/${primaryEntry(layer.files).name}`;

      return {
        type: layer.type,
        name: layer.name,
        path,
        intersectWeight: layer.intersectWeight,
        noIntersectWeight: layer.noIntersectWeight,
      };
    });

    // pyodide's toPy maps JS `null` to a distinct `JsNull` object rather than
    // Python `None`, which breaks every `is not None`/truthy check on the
    // Python side — so optional fields are omitted entirely when absent
    // (Python's dict.get() then returns the real None for a missing key)
    // instead of being set to `null`.
    const manualAnchor = !anchorPath && params.anchorLat !== null && params.anchorLon !== null;

    const pyParams = pyodide.toPy({
      crimes_csv_path: "/input_crimes.csv",
      lat_col: params.latCol,
      lon_col: params.lonCol,
      input_crs: params.inputCrs,
      analysis_crs: params.analysisCrs,
      cells_x: params.cellsX,
      cells_y: params.cellsY,
      f: params.f,
      g: params.g,
      k: params.k,
      b_auto: params.bAuto,
      b_value: params.bValue,
      engine: params.engine,
      use_outliers: params.useOutliers,
      outlier_threshold_multiplier: params.outlierThresholdMultiplier,
      use_normalize: params.useNormalize,
      use_gini: params.useGini,
      ...(anchorPath ? { anchor_path: anchorPath } : {}),
      ...(manualAnchor ? { anchor_lat: params.anchorLat, anchor_lon: params.anchorLon } : {}),
      ...(gridPath ? { grid_path: gridPath } : {}),
      layers: pyLayers,
    });

    const progressCb = async (frac: number, stage: string): Promise<boolean> => {
      onProgress(frac, stage);
      await new Promise((resolve) => setTimeout(resolve, 0));
      return cancelRequested;
    };

    let resultPy: PyProxy | undefined;
    try {
      resultPy = await runFn(pyParams, progressCb);
      const result = resultPy.toJs({
        dict_converter: Object.fromEntries,
      }) as
        | { status: "cancelled" }
        | {
            status: "done";
            b: number;
            n_cells: number;
            cells_x: number | null;
            cells_y: number | null;
            n_crimes: number;
            n_crimes_total: number;
            outliers_removed: number;
            baseline_gini: number | null;
            enhanced_gini: number | null;
            baseline_lorenz: LorenzCurve;
            enhanced_lorenz: LorenzCurve | null;
            baseline_eval: EvalResult | null;
            enhanced_eval: EvalResult | null;
            baseline_geojson: string;
            enhanced_geojson: string | null;
          };

      if (result.status === "cancelled") {
        return { status: "cancelled" };
      }
      return {
        status: "done",
        b: result.b,
        nCells: result.n_cells,
        cellsX: result.cells_x,
        cellsY: result.cells_y,
        nCrimes: result.n_crimes,
        nCrimesTotal: result.n_crimes_total,
        outliersRemoved: result.outliers_removed,
        baselineGini: result.baseline_gini,
        enhancedGini: result.enhanced_gini,
        baselineLorenz: result.baseline_lorenz,
        enhancedLorenz: result.enhanced_lorenz,
        baselineEval: result.baseline_eval,
        enhancedEval: result.enhanced_eval,
        baselineGeoJson: result.baseline_geojson,
        enhancedGeoJson: result.enhanced_geojson,
      };
    } finally {
      resultPy?.destroy();
      pyParams.destroy();
    }
  },
};

export type PyodideWorkerApi = typeof api;

Comlink.expose(api);

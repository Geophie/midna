"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { IoIosHome } from "react-icons/io";
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Marker, useMap } from "react-leaflet";
import { useAppStore } from "@/lib/store";
import { parseCrimePoints, parseAnchorPoint, parseGridOutline, type LatLon } from "@/lib/mapPoints";
import { crsIsKnown, isWgs84, toWgs84 } from "@/lib/crsProject";
import {
  parseGridFeatureCollection,
  bandColor,
  estimateBandLambda,
  isFeatureVisible,
  scoreKeyForView,
  scoreRange,
  type GridFeature,
  type GridFeatureCollection,
  type HeatmapView,
} from "@/lib/geoResult";
import { Toggle } from "@/components/ui/Toggle";
import { useT } from "@/lib/i18n";
import { computeContourBands } from "@/lib/contour";
import {
  canInspectCells,
  cellInspectionDetails,
  representativeCellMinDimensionPx,
  reprojectGridForInspection,
  type ScreenPoint,
} from "@/lib/cellInspection";

const HEATMAP_PANE = "heatmapPane";
const DEFAULT_CENTER: [number, number] = [20, 0];
const DEFAULT_ZOOM = 2;

function numberedDivIcon(n: number): L.DivIcon {
  return L.divIcon({
    className: "",
    html:
      `<div style="background:#2563eb;color:#fff;border-radius:9999px;width:22px;height:22px;` +
      `display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;` +
      `border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.5);">${n}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

const ANCHOR_ICON = L.divIcon({
  className: "",
  html:
    `<div style="background:#1e293b;color:#fff;border-radius:9999px;width:26px;height:26px;` +
    `display:flex;align-items:center;justify-content:center;border:2px solid white;` +
    `box-shadow:0 1px 3px rgba(0,0,0,.5);">${renderToStaticMarkup(<IoIosHome size={15} />)}</div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

/** Creates the dedicated pane the heatmap layer paints into, and keeps its opacity in sync. */
function HeatmapPane({ opacity }: { opacity: number }) {
  const map = useMap();
  useEffect(() => {
    if (!map.getPane(HEATMAP_PANE)) {
      const pane = map.createPane(HEATMAP_PANE);
      pane.style.zIndex = "350";
    }
  }, [map]);
  useEffect(() => {
    const pane = map.getPane(HEATMAP_PANE);
    if (pane) pane.style.opacity = String(opacity);
  }, [map, opacity]);
  return null;
}

/** Fits the map to the given points/bounds whenever the underlying data changes. */
function FitBounds({ latLngs }: { latLngs: [number, number][] }) {
  const map = useMap();
  const signature = latLngs.map((p) => p.join(",")).join(";");
  useEffect(() => {
    if (latLngs.length === 0) return;
    if (latLngs.length === 1) {
      map.setView(latLngs[0], 12);
    } else {
      map.fitBounds(L.latLngBounds(latLngs), { padding: [24, 24] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
  return null;
}

/** Keeps Leaflet's internal size in sync when its container is resized. */
function ResizeSync() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer().parentElement;
    if (!container) return;
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);
  return null;
}

interface CellHover {
  cellId: number;
  score: number;
  point: ScreenPoint;
}

function InteractiveCellLayer({
  fc,
  visibleFeatures,
  scoreKey,
  minScore,
  maxScore,
  lambda,
  canvasRenderer,
  activeView,
  threshold,
  contouringEnabled,
  cellsX,
  cellsY,
  onAvailabilityChange,
  onHover,
}: {
  fc: GridFeatureCollection;
  visibleFeatures: GridFeatureCollection["features"];
  scoreKey: "score" | "score_enhanced";
  minScore: number;
  maxScore: number;
  lambda: number;
  canvasRenderer: L.Canvas;
  activeView: HeatmapView;
  threshold: number;
  contouringEnabled: boolean;
  cellsX: number | null;
  cellsY: number | null;
  onAvailabilityChange: (available: boolean) => void;
  onHover: (hover: CellHover | null) => void;
}) {
  const map = useMap();
  const [canInspect, setCanInspect] = useState(false);
  const hoveredLayer = useRef<L.Path | null>(null);

  const normalStyle = useCallback(
    (feature: GeoJSON.Feature | undefined): L.PathOptions => {
      const score = Number(feature?.properties?.[scoreKey] ?? 0);
      const color = bandColor(score, minScore, maxScore, lambda);
      return {
        fillColor: color,
        color,
        weight: 1,
        fillOpacity: 0.85,
        opacity: 0.85,
        renderer: canvasRenderer,
      };
    },
    [canvasRenderer, lambda, maxScore, minScore, scoreKey]
  );

  const clearHover = useCallback(() => {
    if (hoveredLayer.current) {
      const layer = hoveredLayer.current as L.Path & { feature?: GeoJSON.Feature };
      layer.setStyle(normalStyle(layer.feature));
      hoveredLayer.current = null;
    }
    onHover(null);
  }, [normalStyle, onHover]);

  const measureAvailability = useCallback(() => {
    const representativeSize = representativeCellMinDimensionPx(
      fc,
      ([longitude, latitude]) => {
        const point = map.latLngToContainerPoint([latitude, longitude]);
        return { x: point.x, y: point.y };
      },
      cellsX,
      cellsY
    );
    // Readability only depends on grid geometry + current projection/zoom +
    // contours — NOT on the score-filtered subset. Which cells are actually
    // rendered / hoverable is governed separately by `visibleFeatures`, so
    // moving the score-threshold slider at a fixed zoom must not flip this.
    const next = canInspectCells(contouringEnabled, representativeSize);
    setCanInspect(next);
    if (!next) clearHover();
  }, [cellsX, cellsY, clearHover, contouringEnabled, fc, map]);

  useEffect(() => {
    const initialFrame = requestAnimationFrame(measureAvailability);
    map.on("zoomend", measureAvailability);
    map.on("moveend", measureAvailability);
    map.on("resize", measureAvailability);
    return () => {
      map.off("zoomend", measureAvailability);
      map.off("moveend", measureAvailability);
      map.off("resize", measureAvailability);
      cancelAnimationFrame(initialFrame);
      clearHover();
      onAvailabilityChange(false);
    };
  }, [clearHover, map, measureAvailability, onAvailabilityChange]);

  useEffect(() => {
    onAvailabilityChange(canInspect);
  }, [canInspect, onAvailabilityChange]);

  useEffect(() => {
    map.getContainer().style.cursor = canInspect ? "pointer" : "";
    return () => {
      map.getContainer().style.cursor = "";
    };
  }, [canInspect, map]);

  useEffect(() => {
    clearHover();
  }, [activeView, clearHover, fc, threshold]);

  const showHover = useCallback(
    (event: L.LeafletMouseEvent) => {
      if (!canInspect) return;
      // Handlers are bound to the GeoJSON group, so a feature event arrives
      // propagated: `event.target` is the group (no `.feature`), the hovered
      // cell is `event.propagatedFrom`/`sourceTarget`.
      const layer = (event.propagatedFrom ?? event.sourceTarget ?? event.target) as L.Path & {
        feature?: GridFeature;
      };
      const feature = layer.feature;
      if (!feature) return;

      if (hoveredLayer.current && hoveredLayer.current !== layer) {
        const previous = hoveredLayer.current as L.Path & { feature?: GeoJSON.Feature };
        previous.setStyle(normalStyle(previous.feature));
      }
      layer.setStyle({ weight: 2, color: "#f8fafc", opacity: 1, fillOpacity: 0.9 });
      hoveredLayer.current = layer;
      const point = map.latLngToContainerPoint(event.latlng);
      const details = cellInspectionDetails(feature, scoreKey === "score_enhanced" ? "enhanced" : "baseline");
      onHover({ ...details, point: { x: point.x, y: point.y } });
    },
    [canInspect, map, normalStyle, onHover, scoreKey]
  );

  const hideHover = useCallback(
    (event: L.LeafletMouseEvent) => {
      const layer = (event.propagatedFrom ?? event.sourceTarget ?? event.target) as L.Path;
      if (hoveredLayer.current !== layer) return;
      clearHover();
    },
    [clearHover]
  );

  if (visibleFeatures.length === 0) return null;
  return (
    <GeoJSON
      key={`heatmap-${activeView}-${threshold}`}
      data={{ ...fc, features: visibleFeatures } as unknown as GeoJSON.GeoJsonObject}
      pane={HEATMAP_PANE}
      style={normalStyle}
      eventHandlers={
        canInspect
          ? {
              mouseover: showHover,
              mouseout: hideHover,
              click: showHover,
            }
          : undefined
      }
    />
  );
}

function HeatmapLayer({
  fc,
  activeView,
  threshold,
  resultAnalysisCrs,
  contouringEnabled,
  cellsX,
  cellsY,
  onAvailabilityChange,
  onHover,
}: {
  fc: GridFeatureCollection;
  activeView: HeatmapView;
  threshold: number;
  resultAnalysisCrs: string | null;
  contouringEnabled: boolean;
  cellsX: number | null;
  cellsY: number | null;
  onAvailabilityChange: (available: boolean) => void;
  onHover: (hover: CellHover | null) => void;
}) {
  const canvasRenderer = useMemo(() => L.canvas({ pane: HEATMAP_PANE, padding: 0.5 }), []);
  const scoreKey = scoreKeyForView(activeView);
  const [minScore, maxScore] = useMemo(() => scoreRange(fc, scoreKey), [fc, scoreKey]);
  // Box-Cox λ auto-calibrated from this run's own score skew (see
  // estimateBandLambda) — same λ the legend and contour layer compute for
  // this fc/scoreKey, so a cell's color means the same thing everywhere.
  const lambda = useMemo(() => estimateBandLambda(fc, scoreKey), [fc, scoreKey]);
  const isProjected = (resultAnalysisCrs ?? "EPSG:4326").trim().toUpperCase() !== "EPSG:4326";

  // Projected-CRS runs serialise polygon geometry in the analysis CRS
  // (metres/feet), which Leaflet can't place on its WGS84 map. When proj4 knows
  // the CRS we reproject the polygons client-side — display + hit-testing only,
  // scores/ranks/analysis geometry untouched — so cell inspection behaves the
  // same as for a geographic CRS. Unknown CRS falls back to centroid points.
  // Performance note: reprojects the whole grid once per (fc, crs); a per-cell
  // memo cache is the upgrade path if a huge projected grid ever measures slow.
  const projectedInspectFc = useMemo(() => {
    if (!isProjected) return null;
    const crs = (resultAnalysisCrs ?? "").trim();
    if (!crsIsKnown(crs)) return null;
    const reprojected = reprojectGridForInspection(fc, ([x, y]) => toWgs84(x, y, crs));
    return reprojected.features.length > 0 ? reprojected : null;
  }, [isProjected, resultAnalysisCrs, fc]);
  const inspectFc = projectedInspectFc ?? fc;

  const contourBands = useMemo(
    () =>
      contouringEnabled && !isProjected && cellsX !== null && cellsY !== null
        ? computeContourBands(fc, scoreKey, cellsX, cellsY, threshold)
        : [],
    [contouringEnabled, isProjected, cellsX, cellsY, fc, scoreKey, threshold]
  );
  const visibleFeatures = useMemo(
    () =>
      fc.features.filter((f) => {
        return isFeatureVisible(f, scoreKey, threshold);
      }),
    [fc, scoreKey, threshold]
  );
  // Score-filtered subset of the geometry the interactive layer actually draws
  // (reprojected when projected, the original otherwise). Same properties as
  // `visibleFeatures`, so `isFeatureVisible` classifies them identically.
  const inspectVisible = useMemo(
    () =>
      inspectFc === fc
        ? visibleFeatures
        : inspectFc.features.filter((f) => isFeatureVisible(f, scoreKey, threshold)),
    [inspectFc, fc, visibleFeatures, scoreKey, threshold]
  );

  if (visibleFeatures.length === 0) return null;

  if (contourBands.length > 0) {
    return (
      <>
        {contourBands.map((band) => (
          <GeoJSON
            key={`contour-${activeView}-${threshold}-${band.bandIndex}-${band.threshold}`}
            data={band.geometry}
            pane={HEATMAP_PANE}
            style={{ fillColor: band.color, fillOpacity: 1, color: band.color, weight: 0 }}
          />
        ))}
      </>
    );
  }

  if (isProjected && !projectedInspectFc) {
    // proj4 can't resolve this projected CRS, so there is no map-space polygon
    // to hit-test — fall back to the WGS84 centroid points the pipeline already
    // carries on every feature. No exact cell inspection in this case.
    return (
      <>
        {visibleFeatures.map((f) => (
          <CircleMarker
            key={f.properties.cell_id}
            center={[f.properties.Latitude, f.properties.Longitude]}
            radius={4}
            pane={HEATMAP_PANE}
            pathOptions={{
              color: bandColor(f.properties[scoreKey] ?? 0, minScore, maxScore, lambda),
              fillColor: bandColor(f.properties[scoreKey] ?? 0, minScore, maxScore, lambda),
              fillOpacity: 0.9,
              stroke: false,
              renderer: canvasRenderer,
            }}
          />
        ))}
      </>
    );
  }

  return (
    <InteractiveCellLayer
      fc={inspectFc}
      visibleFeatures={inspectVisible}
      scoreKey={scoreKey}
      minScore={minScore}
      maxScore={maxScore}
      lambda={lambda}
      canvasRenderer={canvasRenderer}
      activeView={activeView}
      threshold={threshold}
      contouringEnabled={contouringEnabled}
      cellsX={cellsX}
      cellsY={cellsY}
      onAvailabilityChange={onAvailabilityChange}
      onHover={onHover}
    />
  );
}

function FloatingCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`pointer-events-auto flex flex-col gap-2 rounded-xl border border-border bg-background-elevated/95 p-2.5 text-xs shadow-lg backdrop-blur ${className}`}
    >
      {children}
    </div>
  );
}

export function MapView({ activeView }: { activeView: HeatmapView }) {
  const t = useT();
  const lang = useAppStore((s) => s.lang);
  const csvText = useAppStore((s) => s.csvText);
  const params = useAppStore((s) => s.params);
  const disabled = useAppStore((s) => s.status === "running" || s.status === "loading-engine");
  const anchorFileName = useAppStore((s) => s.anchorFileName);
  const anchorFileBytes = useAppStore((s) => s.anchorFileBytes);
  const gridFileName = useAppStore((s) => s.gridFileName);
  const gridFileBytes = useAppStore((s) => s.gridFileBytes);
  const result = useAppStore((s) => s.result);
  const heatmapOpacity = useAppStore((s) => s.heatmapOpacity);
  const setHeatmapOpacity = useAppStore((s) => s.setHeatmapOpacity);
  const heatmapView = useAppStore((s) => s.heatmapView);
  const setHeatmapView = useAppStore((s) => s.setHeatmapView);
  const layerVisibility = useAppStore((s) => s.layerVisibility);
  const setLayerVisible = useAppStore((s) => s.setLayerVisible);
  const resultAnalysisCrs = useAppStore((s) => s.resultAnalysisCrs);
  const scoreThreshold = useAppStore((s) => s.scoreThreshold);
  const setScoreThreshold = useAppStore((s) => s.setScoreThreshold);
  const legendVisible = useAppStore((s) => s.legendVisible);
  const setLegendVisible = useAppStore((s) => s.setLegendVisible);
  const contouringEnabled = useAppStore((s) => s.contouringEnabled);
  const setContouringEnabled = useAppStore((s) => s.setContouringEnabled);
  const [cellInspectionAvailable, setCellInspectionAvailable] = useState(false);
  const [cellHover, setCellHover] = useState<CellHover | null>(null);
  const handleCellHover = useCallback((hover: CellHover | null) => setCellHover(hover), []);
  const crsIsProjected = params.analysisCrs.trim() !== "" && params.analysisCrs.trim().toUpperCase() !== "EPSG:4326";
  const contouringAvailable = !gridFileName && !crsIsProjected;
  // Single source of truth: the store value can stay `true` from an earlier run
  // while contours are no longer available (grid file loaded, projected CRS).
  // The map layer and the toggle must agree, so "toggle shows OFF" always means
  // "contours are not covering the cells".
  const contouringActive = contouringEnabled && contouringAvailable;

  const fc = useMemo(() => {
    if (!result) return null;
    const geoJson = activeView === "enhanced" ? result.enhancedGeoJson : result.baselineGeoJson;
    return geoJson ? parseGridFeatureCollection(geoJson) : null;
  }, [result, activeView]);

  const [thresholdMin, thresholdMax] = useMemo(() => {
    if (params.useNormalize) return [0, 100];
    if (!fc) return [0, 0];
    return scoreRange(fc, scoreKeyForView(activeView));
  }, [fc, activeView, params.useNormalize]);
  const threshold = Math.min(Math.max(scoreThreshold[activeView], thresholdMin), thresholdMax);
  const thresholdStep = params.useNormalize ? 1 : Math.max((thresholdMax - thresholdMin) / 200, 1e-6);

  const crimePoints: LatLon[] = useMemo(
    () => (csvText ? parseCrimePoints(csvText, params.latCol, params.lonCol, params.inputCrs) : []),
    [csvText, params.latCol, params.lonCol, params.inputCrs]
  );

  const anchorPoint: LatLon | null = useMemo(() => {
    if (params.anchorMode === "manual") {
      return params.anchorLat !== null && params.anchorLon !== null
        ? { lat: params.anchorLat, lon: params.anchorLon }
        : null;
    }
    if (!anchorFileName || !anchorFileBytes) return null;
    return parseAnchorPoint(anchorFileName, anchorFileBytes, params.latCol, params.lonCol, params.inputCrs);
  }, [params.anchorMode, params.anchorLat, params.anchorLon, anchorFileName, anchorFileBytes, params.latCol, params.lonCol, params.inputCrs]);

  const gridOutline = useMemo(() => (gridFileBytes ? parseGridOutline(gridFileBytes) : null), [gridFileBytes]);

  const fitPoints: [number, number][] = useMemo(() => {
    const pts: [number, number][] = crimePoints.map((p) => [p.lat, p.lon]);
    if (anchorPoint) pts.push([anchorPoint.lat, anchorPoint.lon]);
    return pts;
  }, [crimePoints, anchorPoint]);

  const hasHeatmap = Boolean(result);
  const hasEnhanced = Boolean(result?.enhancedGeoJson);
  const hasCrimes = crimePoints.length > 0;
  const hasAnchor = anchorPoint !== null;
  const hasGrid = gridOutline !== null;

  // Non-WGS84 CSV whose CRS proj4 can't resolve → crime/anchor markers can't be
  // placed. The heatmap still renders correctly after Run (pyproj handles it).
  const crimePreviewUnavailable =
    Boolean(csvText) && !isWgs84(params.inputCrs) && !crsIsKnown(params.inputCrs);

  const showCrimes = layerVisibility.crimes && hasCrimes;
  const showAnchor = layerVisibility.anchor && hasAnchor;
  const showGrid = layerVisibility.grid && !hasHeatmap && hasGrid;
  const showHeatmap = layerVisibility.heatmap && hasHeatmap;
  const CARTO_API_KEY = process.env.NEXT_PUBLIC_CARTO_API_KEY;

  return (
    <div className="flex h-full w-full flex-col lg:relative">
      <div className="relative h-[50vh] shrink-0 lg:h-full">
      <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} className="h-full w-full" attributionControl>
        <TileLayer
           url={`https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${CARTO_API_KEY}`}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        <HeatmapPane opacity={heatmapOpacity} />
        <ResizeSync />
        {showHeatmap && fc && (
          <HeatmapLayer
            fc={fc}
            activeView={activeView}
            threshold={threshold}
            resultAnalysisCrs={resultAnalysisCrs}
            contouringEnabled={contouringActive}
            cellsX={result?.cellsX ?? null}
            cellsY={result?.cellsY ?? null}
            onAvailabilityChange={setCellInspectionAvailable}
            onHover={handleCellHover}
          />
        )}
        {showGrid && gridOutline && (
          <GeoJSON data={gridOutline} style={{ color: "#94a3b8", weight: 1, fillOpacity: 0 }} />
        )}
        {showCrimes && crimePoints.map((p, i) => <Marker key={i} position={[p.lat, p.lon]} icon={numberedDivIcon(i + 1)} />)}
        {showAnchor && anchorPoint && <Marker position={[anchorPoint.lat, anchorPoint.lon]} icon={ANCHOR_ICON} />}
        <FitBounds latLngs={fitPoints} />
      </MapContainer>

      {cellInspectionAvailable && cellHover && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-[500] -translate-x-1/2 -translate-y-[calc(100%+8px)] rounded-lg border border-border bg-background-elevated/95 px-2.5 py-1.5 text-xs shadow-lg backdrop-blur"
          style={{ left: cellHover.point.x, top: cellHover.point.y }}
        >
          <div className="font-medium tabular-nums">
            {t("map_cell_id")}: {cellHover.cellId}
          </div>
          <div className="text-foreground-muted tabular-nums">
            {t("map_cell_score")}: {new Intl.NumberFormat(lang === "it" ? "it-IT" : "en-US", { maximumFractionDigits: 4 }).format(cellHover.score)}
          </div>
        </div>
      )}

      {crimePreviewUnavailable && (
        <div className="pointer-events-none absolute top-3 left-3 z-[1000] max-w-xs">
          <FloatingCard className="text-foreground-muted">
            {t("map_preview_crs_unknown", { crs: params.inputCrs || "—" })}
          </FloatingCard>
        </div>
      )}

      </div>

      {/* Floating overlay controls — the map fills the whole panel edge-to-edge behind these. */}
      <div className="flex flex-col gap-2 p-3 lg:pointer-events-none lg:absolute lg:top-3 lg:right-3 lg:z-[1000] lg:items-end lg:p-0">
        {hasHeatmap && (
          <FloatingCard>
            {hasEnhanced && (
              <div className="flex gap-1 rounded-full border border-border bg-background p-1">
                {(["baseline", "enhanced"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setHeatmapView(v)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      heatmapView === v
                        ? "bg-accent text-accent-foreground"
                        : "text-foreground-muted hover:text-foreground"
                    }`}
                  >
                    {v === "baseline" ? t("model_baseline_label") : t("model_enhanced_label")}
                  </button>
                ))}
              </div>
            )}
            <Toggle
              checked={contouringActive}
              onChange={setContouringEnabled}
              disabled={disabled || !contouringAvailable}
              label={t("contouring_label")}
            />
          </FloatingCard>
        )}
        {hasHeatmap && (
          <FloatingCard>
            <label className="flex items-center gap-2 text-foreground-muted">
              {t("heatmap_opacity_label")}
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={heatmapOpacity}
                onChange={(e) => setHeatmapOpacity(Number(e.target.value))}
                className="w-24"
              />
            </label>
          </FloatingCard>
        )}
        {hasHeatmap && (
          <FloatingCard>
            <label className="flex items-center gap-2 text-foreground-muted">
              {t("score_threshold_label", {
                value: params.useNormalize ? Math.round(threshold) : threshold.toFixed(3),
              })}
              <input
                type="range"
                min={thresholdMin}
                max={thresholdMax}
                step={thresholdStep}
                value={threshold}
                onChange={(e) => setScoreThreshold(activeView, Number(e.target.value))}
                className="w-24"
              />
            </label>
          </FloatingCard>
        )}
        {(hasCrimes || hasAnchor || hasGrid || hasHeatmap) && (
          <FloatingCard>
            {hasCrimes && (
              <Toggle
                checked={layerVisibility.crimes}
                onChange={(v) => setLayerVisible("crimes", v)}
                label={t("layer_toggle_crimes")}
              />
            )}
            {hasAnchor && (
              <Toggle
                checked={layerVisibility.anchor}
                onChange={(v) => setLayerVisible("anchor", v)}
                label={t("layer_toggle_anchor")}
              />
            )}
            {hasGrid && (
              <Toggle
                checked={layerVisibility.grid}
                onChange={(v) => setLayerVisible("grid", v)}
                label={t("layer_toggle_grid")}
              />
            )}
            {hasHeatmap && (
              <Toggle
                checked={layerVisibility.heatmap}
                onChange={(v) => setLayerVisible("heatmap", v)}
                label={t("layer_toggle_heatmap")}
              />
            )}
            {showHeatmap && (
              <Toggle checked={legendVisible} onChange={setLegendVisible} label={t("legend_toggle_label")} />
            )}
          </FloatingCard>
        )}
      </div>

    </div>
  );
}

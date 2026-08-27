"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { IoIosHome } from "react-icons/io";
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Marker, useMap } from "react-leaflet";
import { useAppStore } from "@/lib/store";
import { parseCrimePoints, parseAnchorPoint, parseGridOutline, type LatLon } from "@/lib/mapPoints";
import {
  parseGridFeatureCollection,
  bandColor,
  computeLegendBands,
  estimateBandLambda,
  scoreKeyForView,
  scoreRange,
  type GridFeatureCollection,
  type HeatmapView,
} from "@/lib/geoResult";
import { Legend } from "./Legend";
import { Toggle } from "@/components/ui/Toggle";
import { useT } from "@/lib/i18n";
import { computeContourBands } from "@/lib/contour";

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

/** Keeps Leaflet's internal size in sync when the panel is manually resized (CSS `resize`). */
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

function HeatmapLayer({
  fc,
  activeView,
  threshold,
  resultAnalysisCrs,
  contouringEnabled,
  cellsX,
  cellsY,
}: {
  fc: GridFeatureCollection;
  activeView: HeatmapView;
  threshold: number;
  resultAnalysisCrs: string | null;
  contouringEnabled: boolean;
  cellsX: number | null;
  cellsY: number | null;
}) {
  const canvasRenderer = useMemo(() => L.canvas({ pane: HEATMAP_PANE, padding: 0.5 }), []);
  const scoreKey = scoreKeyForView(activeView);
  // Coloring stays keyed off the score range of the FULL dataset (zero/masked
  // cells excluded), so hiding below-threshold cells never re-scales the
  // color bands of the ones left visible. Same classification as the legend
  // and the contour layer (bandIndexForScore), so color means the same thing
  // everywhere regardless of which layer is drawing it.
  const [minScore, maxScore] = useMemo(() => scoreRange(fc, scoreKey, true), [fc, scoreKey]);
  // Box-Cox λ auto-calibrated from this run's own score skew (see
  // estimateBandLambda) — same λ the legend and contour layer compute for
  // this fc/scoreKey, so a cell's color means the same thing everywhere.
  const lambda = useMemo(() => estimateBandLambda(fc, scoreKey), [fc, scoreKey]);
  const isProjected = (resultAnalysisCrs ?? "EPSG:4326").trim().toUpperCase() !== "EPSG:4326";
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
        // A score of exactly 0 means "no signal for this cell" (outside AOI,
        // masked out, etc.) — always hidden, independent of the threshold,
        // which otherwise governs everything above zero.
        const score = f.properties[scoreKey] ?? 0;
        return score >= threshold;
      }),
    [fc, scoreKey, threshold]
  );

  if (visibleFeatures.length === 0) return null;

  if (contourBands.length > 0) {
    return (
      <>
        {contourBands.map((band) => (
          <GeoJSON
            key={`contour-${activeView}-${band.bandIndex}-${band.threshold}`}
            data={band.geometry}
            pane={HEATMAP_PANE}
            style={{ fillColor: band.color, fillOpacity: 1, color: band.color, weight: 0 }}
          />
        ))}
      </>
    );
  }

  if (isProjected) {
    // The cell polygons themselves are in a projected (metric) CRS, but every
    // feature also carries a Longitude/Latitude centroid already reprojected
    // to EPSG:4326 by the pipeline — fall back to colored centroid points.
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
    <GeoJSON
      key={`heatmap-${activeView}-${threshold}`}
      data={{ ...fc, features: visibleFeatures } as unknown as GeoJSON.GeoJsonObject}
      pane={HEATMAP_PANE}
      style={(feature) => {
        const score = (feature?.properties as { [k: string]: number } | undefined)?.[scoreKey] ?? 0;
        const color = bandColor(score, minScore, maxScore, lambda);
        return {
          fillColor: color,
          // A hairline stroke in the same color as the fill papers over the
          // sub-pixel seams that otherwise appear between thousands of
          // abutting thin grid cells on a canvas renderer (weight: 0 leaves
          // visible gaps between rows/columns at typical zoom levels).
          color,
          weight: 1,
          fillOpacity: 0.85,
          opacity: 0.85,
          renderer: canvasRenderer,
        };
      }}
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
  const crsIsProjected = params.analysisCrs.trim() !== "" && params.analysisCrs.trim().toUpperCase() !== "EPSG:4326";
  const contouringAvailable = !gridFileName && !crsIsProjected;

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

  const legendBands = useMemo(
    () => (fc ? computeLegendBands(fc, scoreKeyForView(activeView)) : []),
    [fc, activeView]
  );

  const crimePoints: LatLon[] = useMemo(
    () => (csvText ? parseCrimePoints(csvText, params.latCol, params.lonCol) : []),
    [csvText, params.latCol, params.lonCol]
  );

  const anchorPoint: LatLon | null = useMemo(() => {
    if (params.anchorMode === "manual") {
      return params.anchorLat !== null && params.anchorLon !== null
        ? { lat: params.anchorLat, lon: params.anchorLon }
        : null;
    }
    if (!anchorFileName || !anchorFileBytes) return null;
    return parseAnchorPoint(anchorFileName, anchorFileBytes, params.latCol, params.lonCol);
  }, [params.anchorMode, params.anchorLat, params.anchorLon, anchorFileName, anchorFileBytes, params.latCol, params.lonCol]);

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

  const showCrimes = layerVisibility.crimes && hasCrimes;
  const showAnchor = layerVisibility.anchor && hasAnchor;
  const showGrid = layerVisibility.grid && !hasHeatmap && hasGrid;
  const showHeatmap = layerVisibility.heatmap && hasHeatmap;
  const CARTO_API_KEY = process.env.NEXT_PUBLIC_CARTO_API_KEY;

  return (
    <div className="relative h-full w-full">
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
            contouringEnabled={contouringEnabled}
            cellsX={result?.cellsX ?? null}
            cellsY={result?.cellsY ?? null}
          />
        )}
        {showGrid && gridOutline && (
          <GeoJSON data={gridOutline} style={{ color: "#94a3b8", weight: 1, fillOpacity: 0 }} />
        )}
        {showCrimes && crimePoints.map((p, i) => <Marker key={i} position={[p.lat, p.lon]} icon={numberedDivIcon(i + 1)} />)}
        {showAnchor && anchorPoint && <Marker position={[anchorPoint.lat, anchorPoint.lon]} icon={ANCHOR_ICON} />}
        <FitBounds latLngs={fitPoints} />
      </MapContainer>

      {/* Floating overlay controls — the map fills the whole panel edge-to-edge behind these. */}
      <div className="pointer-events-none absolute top-3 right-3 z-[1000] flex flex-col items-end gap-2">
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
              checked={contouringEnabled && contouringAvailable}
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

      {showHeatmap && legendVisible && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-[1000] max-h-[calc(100%-1.5rem)]">
          <FloatingCard className="max-h-full overflow-y-auto">
            <Legend bands={legendBands} />
          </FloatingCard>
        </div>
      )}
    </div>
  );
}

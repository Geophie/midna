"use client";

import { Card } from "@/components/ui/Card";
import { FileField } from "@/components/ui/FileField";
import { useAppStore, type LayerEntry } from "@/lib/store";
import type { DemLayerSpec, VectorLayerSpec } from "@/workers/pyodide.worker";
import { buildShapefileBundle } from "@/lib/shapefileBundle";
import { readFileBytes } from "@/lib/readFileBytes";
import { parseLocaleFloat } from "@/lib/parseLocaleFloat";
import { setPayload, deletePayload } from "@/lib/binaryPayloadStore";
import { useT } from "@/lib/i18n";
import { useState } from "react";

const inputClass =
  "rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent";

export function LayerCard({ entry }: { entry: LayerEntry }) {
  const t = useT();
  const removeLayer = useAppStore((s) => s.removeLayer);
  const updateLayer = useAppStore((s) => s.updateLayer);
  const { id, layer } = entry;

  const typeLabel =
    layer.type === "dem" ? t("layer_dem_label") : layer.type === "inclusion" ? t("layer_type_inclusion") : t("layer_type_exclusion");

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={layer.enabled}
            onChange={(e) => updateLayer(id, { enabled: e.target.checked })}
          />
          {typeLabel}
        </label>
        <button
          type="button"
          onClick={() => removeLayer(id)}
          className="text-xs text-foreground-muted hover:text-red-600 dark:hover:text-red-400"
        >
          {t("btn_remove")}
        </button>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        {t("layer_name_label")}
        <input
          className={inputClass}
          value={layer.name}
          onChange={(e) => updateLayer(id, { name: e.target.value })}
        />
      </label>

      {layer.type === "dem" ? (
        <DemFileField id={id} layer={layer} />
      ) : (
        <VectorFileField id={id} layer={layer} />
      )}

      {layer.type === "dem" ? <DemFields id={id} layer={layer} /> : <VectorFields id={id} layer={layer} />}
    </Card>
  );
}

function DemFileField({ id, layer }: { id: string; layer: DemLayerSpec }) {
  const t = useT();
  const updateLayer = useAppStore((s) => s.updateLayer);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const fileBytes = await readFileBytes(file);
      // Keep the real bytes out of Zustand/React state (see binaryPayloadStore.ts) —
      // `layer.fileBytes` stays the empty placeholder from newDemLayer().
      setPayload(id, fileBytes);
      updateLayer(id, { fileName: file.name });
    } finally {
      setBusy(false);
    }
  }

  function handleRemove() {
    deletePayload(id);
    updateLayer(id, { fileName: "" });
  }

  return (
    <label className="flex flex-col gap-1 text-sm">
      {t("dem_file_label")}
      <FileField
        chooseLabel={t("btn_choose_file")}
        accept=".tif,.tiff,.hgt"
        fileName={layer.fileName || null}
        busy={busy}
        onFilesSelected={(files) => void handleFile(files[0])}
        onRemove={handleRemove}
      />
    </label>
  );
}

type VectorMode = "geojson" | "folder" | "multi";

function VectorFileField({ id, layer }: { id: string; layer: VectorLayerSpec }) {
  const t = useT();
  const [mode, setMode] = useState<VectorMode>("geojson");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const updateLayer = useAppStore((s) => s.updateLayer);

  const VECTOR_MODE_LABELS: Record<VectorMode, string> = {
    geojson: t("vector_mode_geojson"),
    folder: t("vector_mode_folder"),
    multi: t("vector_mode_multi"),
  };

  async function handleSingleFile(file: File) {
    setMessage(null);
    setBusy(true);
    try {
      const bytes = await readFileBytes(file);
      updateLayer(id, { files: [{ name: file.name, bytes }] });
    } finally {
      setBusy(false);
    }
  }

  async function handleShapefileParts(fileList: FileList) {
    setMessage(null);
    setBusy(true);
    try {
      const result = await buildShapefileBundle(Array.from(fileList));
      if ("error" in result) {
        setMessage({ text: t(result.error, result.errorVars), isError: true });
        return;
      }
      updateLayer(id, { files: result.bundle });
      setMessage(result.warning ? { text: t(result.warning, result.warningVars), isError: false } : null);
    } finally {
      setBusy(false);
    }
  }

  const isGpkg = layer.files.some((f) => f.name.toLowerCase().endsWith(".gpkg"));
  const filesLabel =
    layer.files.length > 0 ? t("vector_files_loaded", { names: layer.files.map((f) => f.name).join(", ") }) : null;

  function handleRemove() {
    setMessage(null);
    updateLayer(id, { files: [] });
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="text-xs text-foreground-muted">{t("vector_file_desc")}</p>

      <label className="flex flex-col gap-1">
        {t("vector_file_type_label")}
        <select
          className={inputClass}
          value={mode}
          onChange={(e) => setMode(e.target.value as VectorMode)}
        >
          {(Object.keys(VECTOR_MODE_LABELS) as VectorMode[]).map((m) => (
            <option key={m} value={m}>
              {VECTOR_MODE_LABELS[m]}
            </option>
          ))}
        </select>
      </label>

      {mode === "geojson" && (
        <FileField
          chooseLabel={t("btn_choose_file")}
          accept=".geojson,.json"
          fileName={filesLabel}
          busy={busy}
          onFilesSelected={(files) => void handleSingleFile(files[0])}
          onRemove={handleRemove}
        />
      )}

      {mode === "folder" && (
        <FileField
          chooseLabel={t("btn_choose_file")}
          multiple
          directory
          fileName={filesLabel}
          busy={busy}
          resetValueAfterChange
          onFilesSelected={(files) => void handleShapefileParts(files)}
          onRemove={handleRemove}
        />
      )}

      {mode === "multi" && (
        <FileField
          chooseLabel={t("btn_choose_file")}
          multiple
          accept=".shp,.shx,.dbf,.prj,.cpg"
          fileName={filesLabel}
          busy={busy}
          resetValueAfterChange
          onFilesSelected={(files) => void handleShapefileParts(files)}
          onRemove={handleRemove}
        />
      )}

      {message && (
        <span
          className={`text-xs ${message.isError ? "text-red-600 dark:text-red-400" : "text-foreground-muted"}`}
        >
          {message.text}
        </span>
      )}
      {isGpkg && <span className="text-xs text-red-600 dark:text-red-400">{t("gpkg_warning_geojson")}</span>}
    </div>
  );
}

function DemFields({ id, layer }: { id: string; layer: DemLayerSpec }) {
  const t = useT();
  const updateLayer = useAppStore((s) => s.updateLayer);
  const num =
    (key: keyof DemLayerSpec) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      updateLayer(id, { [key]: parseLocaleFloat(e.target.value) } as Partial<DemLayerSpec>);

  return (
    <div className="grid grid-cols-[1fr_1fr] gap-x-4 gap-y-3 text-sm">
      <span className="text-xs font-medium text-foreground-muted">{t("dem_threshold_col_label")}</span>
      <span className="text-xs font-medium text-foreground-muted">{t("weight_col_label")}</span>

      <label className="flex flex-col gap-1">
        {t("terrain_flatland")}
        <input
          type="text"
          inputMode="decimal"
          className={inputClass}
          defaultValue={layer.pianuraMin}
          onChange={num("pianuraMin")}
        />
      </label>
      <label className="flex flex-col gap-1">
        {t("terrain_flatland")}
        <input
          type="text"
          inputMode="decimal"
          className={inputClass}
          defaultValue={layer.lowWeight}
          onChange={num("lowWeight")}
        />
      </label>

      <label className="flex flex-col gap-1">
        {t("terrain_hillside")}
        <input
          type="text"
          inputMode="decimal"
          className={inputClass}
          defaultValue={layer.collinaMin}
          onChange={num("collinaMin")}
        />
      </label>
      <label className="flex flex-col gap-1">
        {t("terrain_hillside")}
        <input
          type="text"
          inputMode="decimal"
          className={inputClass}
          defaultValue={layer.midWeight}
          onChange={num("midWeight")}
        />
      </label>

      <label className="flex flex-col gap-1">
        {t("terrain_mountain")}
        <input
          type="text"
          inputMode="decimal"
          className={inputClass}
          defaultValue={layer.montagnaMin}
          onChange={num("montagnaMin")}
        />
      </label>
      <label className="flex flex-col gap-1">
        {t("terrain_mountain")}
        <input
          type="text"
          inputMode="decimal"
          className={inputClass}
          defaultValue={layer.highWeight}
          onChange={num("highWeight")}
        />
      </label>

      <div />
      <label className="flex flex-col gap-1">
        {t("terrain_nodata")}
        <input
          type="text"
          inputMode="decimal"
          className={inputClass}
          defaultValue={layer.nodataWeight}
          onChange={num("nodataWeight")}
        />
      </label>
    </div>
  );
}

function VectorFields({ id, layer }: { id: string; layer: VectorLayerSpec }) {
  const t = useT();
  const updateLayer = useAppStore((s) => s.updateLayer);
  const num =
    (key: keyof VectorLayerSpec) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      updateLayer(id, { [key]: parseLocaleFloat(e.target.value) } as Partial<VectorLayerSpec>);

  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <label className="flex flex-col gap-1">
        {t("weight_intersect")}
        <input
          type="text"
          inputMode="decimal"
          className={inputClass}
          defaultValue={layer.intersectWeight}
          onChange={num("intersectWeight")}
        />
      </label>
      <label className="flex flex-col gap-1">
        {t("weight_no_intersect")}
        <input
          type="text"
          inputMode="decimal"
          className={inputClass}
          defaultValue={layer.noIntersectWeight}
          onChange={num("noIntersectWeight")}
        />
      </label>
    </div>
  );
}

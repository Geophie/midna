"use client";

import { Toggle } from "@/components/ui/Toggle";
import { useAppStore } from "@/lib/store";
import { readFileBytes } from "@/lib/readFileBytes";
import { parseLocaleFloat } from "@/lib/parseLocaleFloat";
import { useT } from "@/lib/i18n";
import { FileField } from "@/components/ui/FileField";

const inputClass =
  "rounded-lg border border-border bg-background px-3 py-1.5 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-accent sm:text-sm";

function parseCoord(raw: string): number | null {
  if (raw.trim() === "") return null;
  const value = parseLocaleFloat(raw);
  return Number.isFinite(value) ? value : null;
}

export function AnchorPointForm() {
  const t = useT();
  const anchorMode = useAppStore((s) => s.params.anchorMode);
  const anchorLat = useAppStore((s) => s.params.anchorLat);
  const anchorLon = useAppStore((s) => s.params.anchorLon);
  const anchorFileName = useAppStore((s) => s.anchorFileName);
  const setParams = useAppStore((s) => s.setParams);
  const setAnchorFile = useAppStore((s) => s.setAnchorFile);
  const clearAnchorFile = useAppStore((s) => s.clearAnchorFile);

  const latOutOfRange = anchorLat !== null && (anchorLat < -90 || anchorLat > 90);
  const lonOutOfRange = anchorLon !== null && (anchorLon < -180 || anchorLon > 180);
  const isGpkg = (anchorFileName ?? "").toLowerCase().endsWith(".gpkg");

  async function handleFile(file: File) {
    setAnchorFile(file.name, await readFileBytes(file));
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-foreground-muted">{t("anchor_desc")}</p>

      <Toggle
        checked={anchorMode === "manual"}
        onChange={(checked) => setParams({ anchorMode: checked ? "manual" : "file" })}
        label={anchorMode === "manual" ? t("anchor_mode_manual") : t("anchor_mode_file")}
      />

      {anchorMode === "file" ? (
        <label className="flex flex-col gap-1 text-sm">
          {t("anchor_file_label")}
          <FileField
            chooseLabel={t("btn_choose_file")}
            accept=".csv,.geojson,.json"
            fileName={anchorFileName}
            onFilesSelected={(files) => void handleFile(files[0])}
            onRemove={clearAnchorFile}
          />
          {isGpkg && (
            <span className="text-xs text-red-600 dark:text-red-400">{t("gpkg_warning_csv_geojson")}</span>
          )}
        </label>
      ) : (
        <div className="grid grid-cols-2 gap-4 text-sm">
          <label className="flex flex-col gap-1">
            {t("anchor_lat_label")}
            <input
              type="text"
              inputMode="decimal"
              className={inputClass}
              defaultValue={anchorLat ?? ""}
              onChange={(e) => setParams({ anchorLat: parseCoord(e.target.value) })}
            />
            {latOutOfRange && (
              <span className="text-xs text-red-600 dark:text-red-400">{t("lat_out_of_range")}</span>
            )}
          </label>
          <label className="flex flex-col gap-1">
            {t("anchor_lon_label")}
            <input
              type="text"
              inputMode="decimal"
              className={inputClass}
              defaultValue={anchorLon ?? ""}
              onChange={(e) => setParams({ anchorLon: parseCoord(e.target.value) })}
            />
            {lonOutOfRange && (
              <span className="text-xs text-red-600 dark:text-red-400">{t("lon_out_of_range")}</span>
            )}
          </label>
        </div>
      )}
    </div>
  );
}

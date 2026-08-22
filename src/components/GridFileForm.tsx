"use client";

import { useAppStore } from "@/lib/store";
import { readFileBytes } from "@/lib/readFileBytes";
import { useT } from "@/lib/i18n";
import { FileField } from "@/components/ui/FileField";

export function GridFileForm() {
  const t = useT();
  const gridFileName = useAppStore((s) => s.gridFileName);
  const setGridFile = useAppStore((s) => s.setGridFile);
  const clearGridFile = useAppStore((s) => s.clearGridFile);

  const isGpkg = (gridFileName ?? "").toLowerCase().endsWith(".gpkg");

  async function handleFile(file: File) {
    setGridFile(file.name, await readFileBytes(file));
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-foreground-muted">{t("grid_file_desc")}</p>
      <label className="flex flex-col gap-1 text-sm">
        {t("grid_file_label")}
        <FileField
          chooseLabel={t("btn_choose_file")}
          accept=".geojson,.json"
          fileName={gridFileName}
          onFilesSelected={(files) => void handleFile(files[0])}
          onRemove={clearGridFile}
        />
        {isGpkg && <span className="text-xs text-red-600 dark:text-red-400">{t("gpkg_warning_geojson")}</span>}
      </label>
    </div>
  );
}

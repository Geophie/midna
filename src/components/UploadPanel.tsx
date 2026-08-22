"use client";

import { useMemo, useState } from "react";
import { preflightCrimesCsv } from "@/lib/csvPreflight";
import { useAppStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { FileField } from "@/components/ui/FileField";

export function UploadPanel() {
  const t = useT();
  const params = useAppStore((s) => s.params);
  const csvText = useAppStore((s) => s.csvText);
  const csvFileName = useAppStore((s) => s.csvFileName);
  const setCsv = useAppStore((s) => s.setCsv);
  const clearCsv = useAppStore((s) => s.clearCsv);
  const [preflightErrors, setPreflightErrors] = useState<string[]>([]);

  // Derived from the persisted csvText (not local state) so it survives
  // UploadPanel unmounting/remounting on tab switches.
  const rowCount = useMemo(
    () => (csvText ? preflightCrimesCsv(csvText, params.latCol, params.lonCol).rowCount : null),
    [csvText, params.latCol, params.lonCol]
  );

  async function handleFile(file: File) {
    const text = await file.text();
    const result = preflightCrimesCsv(text, params.latCol, params.lonCol);
    setPreflightErrors(result.errors);
    if (result.ok) {
      setCsv(file.name, text);
    } else {
      setCsv("", "");
    }
  }

  function handleRemove() {
    clearCsv();
    setPreflightErrors([]);
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-sm">
        {t("upload_csv_label")}
        <FileField
          chooseLabel={t("btn_choose_file")}
          accept=".csv,text/csv"
          fileName={csvFileName ? t("upload_loaded", { name: csvFileName, rows: rowCount ?? 0 }) : null}
          onFilesSelected={(files) => void handleFile(files[0])}
          onRemove={handleRemove}
        />
      </label>
      {preflightErrors.length > 0 && (
        <ul className="list-disc pl-5 text-sm text-red-600 dark:text-red-400">
          {preflightErrors.map((err) => (
            <li key={err}>{t(err)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

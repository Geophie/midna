"use client";

import { useId, type ChangeEvent } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { useT } from "@/lib/i18n";

export function FileField({
  chooseLabel,
  fileName,
  onFilesSelected,
  onRemove,
  accept,
  multiple,
  directory,
  busy,
  resetValueAfterChange,
}: {
  chooseLabel: string;
  fileName: string | null;
  onFilesSelected: (files: FileList) => void;
  onRemove?: () => void;
  accept?: string;
  multiple?: boolean;
  directory?: boolean;
  busy?: boolean;
  resetValueAfterChange?: boolean;
}) {
  const t = useT();
  const id = useId();

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor={id}
        className="shrink-0 cursor-pointer rounded-full bg-accent-soft px-3 py-1 text-sm font-medium text-accent"
      >
        {chooseLabel}
      </label>
      <input
        id={id}
        type="file"
        className="hidden"
        accept={accept}
        multiple={multiple}
        {...(directory ? { webkitdirectory: "" } : {})}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          if (e.target.files && e.target.files.length > 0) onFilesSelected(e.target.files);
          if (resetValueAfterChange) e.target.value = "";
        }}
      />
      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm">
        {busy && <Spinner />}
        <span className="truncate">
          {fileName ? (
            <span className="text-green-700 dark:text-green-400">{fileName}</span>
          ) : (
            <span className="text-foreground-muted">{t("no_file_selected")}</span>
          )}
        </span>
      </div>
      {fileName && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent hover:opacity-80"
        >
          {t("btn_remove")}
        </button>
      )}
    </div>
  );
}

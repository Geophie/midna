"use client";

import { useT } from "@/lib/i18n";

export function Spinner() {
  const t = useT();
  return (
    <span
      role="status"
      aria-label={t("loading_in_progress")}
      className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-accent border-t-transparent"
    />
  );
}

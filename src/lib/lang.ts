import type { Lang } from "@/lib/store";

const STORAGE_KEY = "midna-webapp-lang";

export function readStoredLang(): Lang | null {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "it" || stored === "en" ? stored : null;
}

export function storeLang(lang: Lang): void {
  window.localStorage.setItem(STORAGE_KEY, lang);
}

/** Mirrors the desktop tool's `_detect_system_lang()`: Italian if the
 * device/browser language starts with "it", English otherwise. */
export function detectDeviceLang(): Lang {
  const primary = navigator.languages?.[0] ?? navigator.language ?? "";
  return primary.toLowerCase().startsWith("it") ? "it" : "en";
}

"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { readStoredLang, storeLang, detectDeviceLang } from "@/lib/lang";
import { useT } from "@/lib/i18n";

export function LanguageToggle() {
  const t = useT();
  const lang = useAppStore((s) => s.lang);
  const setLang = useAppStore((s) => s.setLang);

  useEffect(() => {
    // A language the user already picked in this browser wins; otherwise
    // default from the device/browser language, same as the desktop tool.
    setLang(readStoredLang() ?? detectDeviceLang());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  function toggle() {
    const next = lang === "it" ? "en" : "it";
    setLang(next);
    storeLang(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={lang === "it" ? t("lang_toggle_aria_to_en") : t("lang_toggle_aria_to_it")}
      title={t("lang_toggle_title")}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background-elevated text-xs font-semibold text-foreground-muted transition-colors hover:text-foreground"
    >
      {lang === "it" ? "IT" : "EN"}
    </button>
  );
}

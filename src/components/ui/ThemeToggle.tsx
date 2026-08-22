"use client";

import { toggleTheme } from "@/lib/theme";
import { useT } from "@/lib/i18n";

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="4" />
      <path
        strokeLinecap="round"
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}

export function ThemeToggle() {
  const t = useT();
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={t("theme_toggle_aria")}
      title={t("theme_toggle_title")}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background-elevated text-foreground-muted transition-colors hover:text-foreground"
    >
      {/* Which icon shows is a pure function of the data-theme attribute
          (already set pre-paint by THEME_INIT_SCRIPT) via the `dark:`
          variant — no React state, so no hydration mismatch is possible. */}
      <span className="dark:hidden">
        <MoonIcon />
      </span>
      <span className="hidden dark:inline-flex">
        <SunIcon />
      </span>
    </button>
  );
}

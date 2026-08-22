export type Theme = "light" | "dark";

const STORAGE_KEY = "midna-webapp-theme";

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readStoredTheme(): Theme | null {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : null;
}

/**
 * Flips the `data-theme` attribute directly, imperatively — not React state.
 * The icon swap is pure CSS (`dark:` variant keyed off that same attribute,
 * see ThemeToggle.tsx), so there is no client-only value driving render
 * output and therefore nothing that can hydration-mismatch.
 */
export function toggleTheme(): void {
  const current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  const next: Theme = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  window.localStorage.setItem(STORAGE_KEY, next);
}

/** Inlined into <head> to set data-theme before first paint (no flash). */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
    var theme = stored === "light" || stored === "dark"
      ? stored
      : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {}
})();
`;

// Exported for completeness/tests — not needed by ThemeToggle itself, which
// reads the DOM directly on click.
export { systemTheme, readStoredTheme };

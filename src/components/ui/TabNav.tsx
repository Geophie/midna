import type { ReactNode } from "react";

export interface TabDef {
  id: string;
  label: string;
  icon?: ReactNode;
}

export function TabNav({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: TabDef[];
  activeTab: string;
  onChange: (id: string) => void;
}) {
  return (
    <>
      {/* ── Desktop: centered pill bar (unchanged) ── */}
      <nav
        role="tablist"
        className="hidden flex-nowrap gap-1 overflow-x-auto rounded-full border border-border bg-background-elevated p-1 lg:flex"
      >
        {tabs.map((tab) => {
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.id)}
              className={`shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-foreground-muted hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* ── Mobile: fixed bottom tab bar ── */}
      <nav
        role="tablist"
        className="fixed inset-x-0 bottom-0 z-[9999] flex items-end justify-around border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        {tabs.map((tab) => {
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.id)}
              className={`flex flex-1 flex-col items-center gap-0.5 px-1 pt-2 pb-1.5 text-[10px] font-medium transition-colors ${
                active
                  ? "text-accent"
                  : "text-foreground-muted active:text-foreground"
              }`}
            >
              {tab.icon && (
                <span className={`text-lg ${active ? "text-accent" : ""}`}>
                  {tab.icon}
                </span>
              )}
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}

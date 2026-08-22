export interface TabDef {
  id: string;
  label: string;
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
    <nav
      role="tablist"
      className="flex flex-nowrap gap-1 overflow-x-auto rounded-full border border-border bg-background-elevated p-1"
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
  );
}

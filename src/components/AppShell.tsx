import type { ReactNode } from "react";
import { TabNav, type TabDef } from "@/components/ui/TabNav";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { Toggle } from "@/components/ui/Toggle";
import { useT } from "@/lib/i18n";

export function AppShell({
  tabs,
  activeTab,
  onTabChange,
  children,
  mapPanelVisible,
  onMapPanelVisibleChange,
  mapPanel,
}: {
  tabs: TabDef[];
  activeTab: string;
  onTabChange: (id: string) => void;
  children: ReactNode;
  mapPanelVisible: boolean;
  onMapPanelVisibleChange: (visible: boolean) => void;
  mapPanel: ReactNode;
}) {
  const t = useT();
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Outer columns use minmax(0,1fr) (not plain 1fr) so they end up equal
          width regardless of the title's vs controls' natural content width —
          that's what keeps the auto-sized middle (tabs) column mathematically
          centered on the page. The header's own horizontal inset (mx-auto/max-w
          or plain px-6) is kept identical to whichever `main` layout is active
          below, so the title lines up with the main column's left edge in
          both modes. */}
      <header
        className={`grid w-full grid-cols-1 items-center gap-4 px-6 pt-8 pb-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] ${
          mapPanelVisible ? "" : "mx-auto max-w-5xl"
        }`}
      >
        <div className="flex h-12 items-center gap-3">
          {/* Static export has no Next image optimizer. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/midna-logo.png?v=2" alt="MIDNA" width={48} height={48} className="h-12 w-12 shrink-0 object-contain" />
          <div>
            <h1 className="text-xl font-semibold">MIDNA</h1>
            <p className="text-sm text-foreground-muted">{t("app_subtitle")}</p>
          </div>
        </div>
        <TabNav tabs={tabs} activeTab={activeTab} onChange={onTabChange} />
        <div className="flex flex-nowrap items-center justify-end gap-3">
          <Toggle checked={mapPanelVisible} onChange={onMapPanelVisibleChange} label={t("map_toggle_label")} />
          <ThemeToggle />
          <LanguageToggle />
        </div>
      </header>

      {mapPanelVisible ? (
        <div className="flex flex-1 flex-col lg:flex-row">
          <main className="min-w-0 px-6 pb-16 lg:max-w-2xl lg:flex-1 lg:py-6 lg:pr-6">{children}</main>
          {/* Full-bleed on lg+: touches the viewport's right/bottom edges, no card/border/gap. */}
          <div className="hidden lg:sticky lg:top-0 lg:block lg:h-screen lg:min-w-[360px] lg:flex-1">
            {mapPanel}
          </div>
        </div>
      ) : (
        <main className="mx-auto w-full max-w-5xl px-6 pb-16">{children}</main>
      )}
    </div>
  );
}

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { TabNav, type TabDef } from "@/components/ui/TabNav";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { Toggle } from "@/components/ui/Toggle";
import { useT } from "@/lib/i18n";

const DEFAULT_LEFT_WIDTH = 672;
const MAX_LEFT_WIDTH = 1024;
const MIN_LEFT_WIDTH = 480;
const MIN_MAP_WIDTH = 360;
const SPLITTER_WIDTH = 24;
const KEYBOARD_STEP = 24;

function clampLeftPanelWidth(width: number, workspaceWidth: number) {
  const maxWidth = Math.max(0, Math.min(MAX_LEFT_WIDTH, workspaceWidth - MIN_MAP_WIDTH - SPLITTER_WIDTH));
  return Math.min(Math.max(width, Math.min(MIN_LEFT_WIDTH, maxWidth)), maxWidth);
}

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
  const workspaceRef = useRef<HTMLDivElement>(null);
  const draggingPointerId = useRef<number | null>(null);
  const [leftPanelWidth, setLeftPanelWidth] = useState(DEFAULT_LEFT_WIDTH);

  const updateLeftPanelWidth = (width: number) => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const nextWidth = clampLeftPanelWidth(width, workspace.getBoundingClientRect().width);
    setLeftPanelWidth((currentWidth) => (currentWidth === nextWidth ? currentWidth : nextWidth));
  };

  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;

    const syncWidth = () => {
      const workspaceWidth = workspace.getBoundingClientRect().width;
      setLeftPanelWidth((currentWidth) => {
        const nextWidth = clampLeftPanelWidth(currentWidth, workspaceWidth);
        return currentWidth === nextWidth ? currentWidth : nextWidth;
      });
    };
    syncWidth();
    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(syncWidth);
    observer.observe(workspace);
    return () => observer.disconnect();
  }, []);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const workspace = workspaceRef.current;
    if (!workspace) return;
    draggingPointerId.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateLeftPanelWidth(event.clientX - workspace.getBoundingClientRect().left);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (draggingPointerId.current !== event.pointerId) return;
    const workspace = workspaceRef.current;
    if (!workspace) return;
    updateLeftPanelWidth(event.clientX - workspace.getBoundingClientRect().left);
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (draggingPointerId.current !== event.pointerId) return;
    draggingPointerId.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleSplitterKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const direction = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
    if (!direction) return;
    const workspace = workspaceRef.current;
    if (!workspace) return;
    event.preventDefault();
    const workspaceWidth = workspace.getBoundingClientRect().width;
    setLeftPanelWidth((currentWidth) => clampLeftPanelWidth(currentWidth + direction * KEYBOARD_STEP, workspaceWidth));
  };

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
        <div
          ref={workspaceRef}
          className="flex flex-1 flex-col lg:flex-row"
          style={{ "--left-panel-width": `${leftPanelWidth}px` } as CSSProperties}
        >
          <main className="min-w-0 px-6 pb-16 lg:w-[var(--left-panel-width)] lg:shrink-0 lg:py-6 lg:pr-6">{children}</main>
          <div
            role="separator"
            aria-label="Resize workspace"
            aria-orientation="vertical"
            tabIndex={0}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onLostPointerCapture={handlePointerEnd}
            onKeyDown={handleSplitterKeyDown}
            className="group relative hidden w-6 shrink-0 cursor-col-resize touch-none focus:outline-none lg:block"
          >
            <span className="absolute inset-y-6 left-1/2 w-px -translate-x-1/2 bg-border transition-colors group-hover:bg-accent group-focus:bg-accent" />
          </div>
          <div className="hidden min-w-0 flex-1 lg:sticky lg:top-0 lg:block lg:h-screen lg:py-6 lg:pr-6">
            {mapPanel}
          </div>
        </div>
      ) : (
        <main className="mx-auto w-full max-w-5xl px-6 pb-16">{children}</main>
      )}
    </div>
  );
}

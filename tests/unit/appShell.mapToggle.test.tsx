import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/pyodideClient", () => ({ getPyodideApi: () => ({ runAnalysis: vi.fn(), requestCancel: vi.fn() }) }));
vi.mock("@/lib/longTaskObserver", () => ({ startLongTaskObserver: vi.fn() }));

import { AppShell } from "@/components/AppShell";

// Minimal ResizeObserver so AppShell's effect takes the real bind/cleanup path
// (jsdom has none). observe/disconnect are no-ops; toggling the map panel must
// still rebind it to the freshly mounted workspace node without throwing.
class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function Harness() {
  const [mapPanelVisible, setMapPanelVisible] = useState(true);
  return (
    <>
      <button onClick={() => setMapPanelVisible((v) => !v)}>toggle-map</button>
      <AppShell
        tabs={[{ id: "input", label: "Input" }]}
        activeTab="input"
        onTabChange={vi.fn()}
        mapPanelVisible={mapPanelVisible}
        onMapPanelVisibleChange={setMapPanelVisible}
        mapPanel={<div>Map panel body</div>}
      >
        <div>Application content</div>
      </AppShell>
    </>
  );
}

function workspaceStyleWidth(): string | null {
  const separator = document.querySelector('[role="separator"][aria-label="Resize workspace"]');
  const workspace = separator?.parentElement ?? null;
  return workspace ? workspace.style.getPropertyValue("--left-panel-width") : null;
}

describe("AppShell map hide/show", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", TestResizeObserver);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("toggles the map workspace on/off without collapsing the controls panel or crashing", () => {
    render(<Harness />);
    const toggle = screen.getByRole("button", { name: "toggle-map" });

    // Shown: workspace + resize separator mounted, panel width at its default.
    expect(screen.getByRole("separator", { name: "Resize workspace" })).toBeTruthy();
    expect(screen.getByText("Map panel body")).toBeTruthy();
    const shownWidth = workspaceStyleWidth();
    expect(shownWidth).toMatch(/^\d+px$/);
    expect(Number.parseFloat(shownWidth!)).toBeGreaterThan(0);

    // Hidden: workspace node unmounts, content stays reachable.
    fireEvent.click(toggle);
    expect(screen.queryByRole("separator", { name: "Resize workspace" })).toBeNull();
    expect(screen.getByText("Application content")).toBeTruthy();

    // Shown again: fresh workspace node, observer rebinds, no throw, and the
    // panel width is still the non-zero default (never clamped to 0).
    fireEvent.click(toggle);
    expect(screen.getByRole("separator", { name: "Resize workspace" })).toBeTruthy();
    const reshownWidth = workspaceStyleWidth();
    expect(reshownWidth).toMatch(/^\d+px$/);
    expect(Number.parseFloat(reshownWidth!)).toBeGreaterThan(0);
  });
});

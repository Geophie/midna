import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const worker = vi.hoisted(() => ({ runAnalysis: vi.fn(), requestCancel: vi.fn() }));
vi.mock("@/lib/pyodideClient", () => ({ getPyodideApi: () => worker }));
vi.mock("@/lib/longTaskObserver", () => ({ startLongTaskObserver: vi.fn() }));
vi.mock("@/components/RunBar", () => ({ RunBar: ({ onRun }: { onRun: () => void }) => <button onClick={onRun}>Run analysis</button> }));
vi.mock("@/components/MapPanel/MapPanel", () => ({ MapPanel: () => <div>Map</div> }));
vi.mock("@/components/tabs/InputTab", () => ({ InputTab: () => <div>Input</div> }));
vi.mock("@/components/tabs/ParametriTab", () => ({ ParametriTab: () => <div>Parameters</div> }));
vi.mock("@/components/tabs/LayersTab", () => ({ LayersTab: () => <div>Layers</div> }));
vi.mock("@/components/tabs/OutputTab", () => ({ OutputTab: () => <div>Output</div> }));
vi.mock("@/components/tabs/HelpTab", () => ({ HelpTab: () => <div>Help</div> }));

import { AppShell } from "@/components/AppShell";
import Home from "@/app/page";
import { STRINGS } from "@/lib/i18n";
import { ATLANTA_DOI_URL, ATLANTA_PAPER_TITLE } from "@/lib/atlantaNotice";
import { useAppStore } from "@/lib/store";

const onTabChange = vi.fn();

function renderShell() {
  return render(
    <AppShell
      tabs={[{ id: "input", label: "Input" }]}
      activeTab="input"
      onTabChange={onTabChange}
      mapPanelVisible={false}
      onMapPanelVisibleChange={vi.fn()}
      mapPanel={<div>Map</div>}
    >
      <div>Application content</div>
    </AppShell>,
  );
}

describe("Atlanta published-results notice", () => {
  beforeEach(() => {
    localStorage.setItem("midna-webapp-lang", "en");
    useAppStore.setState({ lang: "en" });
    onTabChange.mockReset();
    worker.runAnalysis.mockReset();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    useAppStore.setState({ csvText: null, csvFileName: null, lang: "en" });
  });

  it("places the always-visible labelled warning control between the brand and desktop navigation", () => {
    renderShell();
    const button = screen.getByRole("button", { name: STRINGS.en.atlanta_notice_button_aria });
    const header = button.closest("header");
    const brandGroup = button.parentElement;
    const desktopNav = header?.querySelector("nav.hidden");

    expect(button.isConnected).toBe(true);
    expect(button.className).not.toContain("hidden");
    expect(brandGroup?.textContent).toContain("MIDNA");
    expect(header && brandGroup && desktopNav && Array.from(header.children).indexOf(brandGroup)).toBe(0);
    expect(header && desktopNav && Array.from(header.children).indexOf(desktopNav)).toBe(1);
  });

  it("opens an accessible dialog without changing analysis state or triggering navigation", async () => {
    renderShell();
    const paramsBefore = useAppStore.getState().params;
    const button = screen.getByRole("button", { name: STRINGS.en.atlanta_notice_button_aria });
    fireEvent.click(button);

    const dialog = screen.getByRole("dialog", { name: "Notice regarding the published Atlanta results" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.textContent).toContain("2.56%");
    expect(useAppStore.getState().params).toEqual(paramsBefore);
    expect(onTabChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: STRINGS.en.atlanta_notice_close_aria }));
  });

  it("closes from the close button and returns focus to the warning control", async () => {
    renderShell();
    const button = screen.getByRole("button", { name: STRINGS.en.atlanta_notice_button_aria });
    fireEvent.click(button);
    fireEvent.click(screen.getByRole("button", { name: STRINGS.en.atlanta_notice_close_aria }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(button);
    expect(button.isConnected).toBe(true);
  });

  it("closes from the acknowledgement button without changing parameters", () => {
    renderShell();
    const paramsBefore = useAppStore.getState().params;
    const button = screen.getByRole("button", { name: STRINGS.en.atlanta_notice_button_aria });
    fireEvent.click(button);

    const acknowledgement = screen.getByRole("button", { name: STRINGS.en.atlanta_notice_acknowledge });
    expect(acknowledgement.textContent).toBe("I understand");
    fireEvent.click(acknowledgement);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(button);
    expect(button.isConnected).toBe(true);
    expect(useAppStore.getState().params).toEqual(paramsBefore);
  });

  it("closes on Escape and returns focus to the warning control", async () => {
    renderShell();
    const button = screen.getByRole("button", { name: STRINGS.en.atlanta_notice_button_aria });
    fireEvent.click(button);
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it("updates the open notice through the existing language store", () => {
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: STRINGS.en.atlanta_notice_button_aria }));
    expect(screen.getByRole("dialog").textContent).toContain("2.56%");

    act(() => useAppStore.getState().setLang("it"));
    expect(screen.getByRole("dialog", { name: "Avviso relativo ai risultati pubblicati per il caso studio di Atlanta" }).textContent).toContain("2,56%");
    expect(screen.getByRole("button", { name: STRINGS.it.atlanta_notice_button_aria }).isConnected).toBe(true);
    expect(screen.getByRole("button", { name: STRINGS.it.atlanta_notice_acknowledge }).textContent).toBe("Ho capito");
  });

  it("renders the paper title in <strong> and the DOI as a keyboard-focusable new-tab link (EN and IT)", () => {
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: STRINGS.en.atlanta_notice_button_aria }));

    const assertMarkup = () => {
      const strong = screen.getByText(ATLANTA_PAPER_TITLE);
      expect(strong.tagName).toBe("STRONG");

      const link = screen.getByRole("link", { name: ATLANTA_DOI_URL });
      expect(link.tagName).toBe("A");
      expect(link.getAttribute("href")).toBe("https://doi.org/10.1186/s40163-026-00278-w");
      expect(link.textContent).toBe("https://doi.org/10.1186/s40163-026-00278-w");
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toContain("noopener noreferrer");
    };

    assertMarkup();
    expect(screen.getByRole("dialog").textContent).toContain(
      `review of the study "${ATLANTA_PAPER_TITLE}" published in Crime Science, Springer Nature (${ATLANTA_DOI_URL}) identified an error`,
    );

    act(() => useAppStore.getState().setLang("it"));
    assertMarkup();
    expect(screen.getByRole("dialog").textContent).toContain(
      `pubblicazione dello studio "${ATLANTA_PAPER_TITLE}", pubblicato su Crime Science, Springer Nature (${ATLANTA_DOI_URL}), ha individuato`,
    );
  });

  it("does not call runAnalysis when the notice opens or closes", () => {
    useAppStore.setState({ csvText: "Latitude,Longitude\n1,2", csvFileName: "crimes.csv" });
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: STRINGS.en.atlanta_notice_button_aria }));
    fireEvent.click(screen.getByRole("button", { name: STRINGS.en.atlanta_notice_close_aria }));

    expect(worker.runAnalysis).not.toHaveBeenCalled();
  });
});

import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const worker = vi.hoisted(() => ({ inspectAnalysisCrs: vi.fn() }));

vi.mock("@/lib/pyodideClient", () => ({
  getPyodideApi: () => worker,
}));

import { ParamsForm } from "@/components/ParamsForm";
import { STRINGS } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";

const EN = STRINGS.en;

function setCrs(inputCrs: string, analysisCrs: string) {
  useAppStore.setState((state) => ({
    lang: "en",
    status: "idle",
    params: { ...state.params, inputCrs, analysisCrs },
  }));
}

async function inspectAfterDelay() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(250);
  });
}

describe("ParamsForm geographic analysis-CRS warning", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    worker.inspectAnalysisCrs.mockReset();
    setCrs("EPSG:4326", "EPSG:32616");
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("warns for a geographic analysis CRS and hides the warning for a projected one", async () => {
    worker.inspectAnalysisCrs.mockImplementation(async (crs: string) => ({
      valid: true,
      isGeographic: crs === "EPSG:4326",
    }));
    const screen = render(<ParamsForm />);
    await inspectAfterDelay();
    expect(screen.queryByRole("alert")).toBeNull();

    fireEvent.change(screen.getByLabelText(EN.crs_output), { target: { value: "EPSG:4326" } });
    await inspectAfterDelay();
    expect(screen.getByRole("alert").textContent).toContain(EN.crs_geographic_warning_title);

    fireEvent.change(screen.getByLabelText(EN.crs_output), { target: { value: "EPSG:32616" } });
    await inspectAfterDelay();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the default geographic warning synchronously before worker inspection", () => {
    setCrs("EPSG:4326", "EPSG:4326");
    const screen = render(<ParamsForm />);

    expect(screen.getByRole("alert").textContent).toContain(EN.crs_geographic_warning_title);
    expect(worker.inspectAnalysisCrs).not.toHaveBeenCalled();
  });

  it("keeps the known default warning visible when advisory inspection fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    worker.inspectAnalysisCrs.mockRejectedValue(new Error("worker unavailable"));
    setCrs("EPSG:4326", "EPSG:4326");
    const screen = render(<ParamsForm />);

    expect(screen.getByRole("alert").textContent).toContain(EN.crs_geographic_warning_title);
    await inspectAfterDelay();
    expect(screen.getByRole("alert").textContent).toContain(EN.crs_geographic_warning_title);
    consoleError.mockRestore();
  });

  it("uses semantic worker inspection for arbitrary geographic and projected CRS values", async () => {
    worker.inspectAnalysisCrs.mockImplementation(async (crs: string) => ({
      valid: true,
      isGeographic: crs === "EPSG:4269",
    }));
    setCrs("EPSG:4326", "EPSG:4269");
    const screen = render(<ParamsForm />);
    await inspectAfterDelay();
    expect(screen.getByRole("alert").textContent).toContain(EN.crs_geographic_warning_title);

    fireEvent.change(screen.getByLabelText(EN.crs_output), { target: { value: "EPSG:3857" } });
    await inspectAfterDelay();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("does not let a stale geographic inspection overwrite a newer projected CRS", async () => {
    let resolveGeographic: ((value: { valid: boolean; isGeographic: boolean }) => void) | undefined;
    worker.inspectAnalysisCrs.mockImplementation((crs: string) => {
      if (crs === "EPSG:4326") {
        return new Promise((resolve) => { resolveGeographic = resolve; });
      }
      return Promise.resolve({ valid: true, isGeographic: false });
    });
    setCrs("EPSG:4326", "EPSG:4326");
    const screen = render(<ParamsForm />);
    await inspectAfterDelay();

    fireEvent.change(screen.getByLabelText(EN.crs_output), { target: { value: "EPSG:32616" } });
    await inspectAfterDelay();
    await act(async () => { resolveGeographic?.({ valid: true, isGeographic: true }); });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("does not warn for a geographic input CRS when the analysis CRS is projected", async () => {
    worker.inspectAnalysisCrs.mockResolvedValue({ valid: true, isGeographic: false });
    const screen = render(<ParamsForm />);
    await inspectAfterDelay();
    expect(worker.inspectAnalysisCrs).toHaveBeenCalledWith("EPSG:32616");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps an inspection failure advisory-only", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    worker.inspectAnalysisCrs.mockRejectedValue(new Error("worker unavailable"));
    const screen = render(<ParamsForm />);
    await inspectAfterDelay();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByLabelText(EN.crs_output).getAttribute("disabled")).toBeNull();
    consoleError.mockRestore();
  });
});

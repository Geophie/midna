import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LayersTab } from "@/components/tabs/LayersTab";
import { useAppStore } from "@/lib/store";
import type { DemLayerSpec } from "@/workers/pyodide.worker";

const ORDER_ERROR =
  "DEM elevation thresholds must be strictly increasing from the lowest to the highest elevation class.";

afterEach(() => {
  cleanup();
  useAppStore.setState({ layers: [], lang: "en" });
});

function renderDemLayer() {
  useAppStore.setState({ layers: [], lang: "en" });
  render(<LayersTab />);
  fireEvent.click(screen.getByRole("button", { name: "DEM" }));
}

// pianuraMin defaults to 0, same as nodataWeight — it is the first "0" input
// in DOM order (threshold column precedes the nodata weight row below it).
function pianuraInput(): HTMLInputElement {
  return screen.getAllByDisplayValue("0")[0] as HTMLInputElement;
}

describe("LayerCard DEM threshold order — immediate inline feedback", () => {
  it("1. shows no ordering error for the initial valid 0/250/350 defaults", () => {
    renderDemLayer();
    expect(screen.queryByText(ORDER_ERROR)).toBeNull();
  });

  it("2. shows the ordering error immediately when pianuraMin becomes 300 (no Run press)", () => {
    renderDemLayer();
    const pianura = pianuraInput();
    fireEvent.change(pianura, { target: { value: "300" } });

    expect(useAppStore.getState().layers[0]?.layer).toMatchObject({ pianuraMin: 300 });
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe(ORDER_ERROR);
  });

  it("3. clears the ordering error immediately when pianuraMin is restored to 0", () => {
    renderDemLayer();
    const pianura = pianuraInput();
    fireEvent.change(pianura, { target: { value: "300" } });
    expect(screen.getByRole("alert").textContent).toBe(ORDER_ERROR);

    fireEvent.change(pianura, { target: { value: "0" } });
    expect(screen.queryByText(ORDER_ERROR)).toBeNull();
  });

  it("4. shows the ordering error immediately when collinaMin (400) exceeds montagnaMin (350)", () => {
    renderDemLayer();
    const collina = screen.getByDisplayValue("250") as HTMLInputElement;
    fireEvent.change(collina, { target: { value: "400" } });

    expect(screen.getByRole("alert").textContent).toBe(ORDER_ERROR);
  });

  it("5. shows the ordering error when collinaMin equals montagnaMin", () => {
    renderDemLayer();
    const collina = screen.getByDisplayValue("250") as HTMLInputElement;
    fireEvent.change(collina, { target: { value: "350" } });

    expect(screen.getByRole("alert").textContent).toBe(ORDER_ERROR);
  });

  it("6. accepts a valid negative sequence (-100 / 50 / 400) with no ordering error", () => {
    renderDemLayer();
    fireEvent.change(pianuraInput(), { target: { value: "-100" } });
    fireEvent.change(screen.getByDisplayValue("250"), { target: { value: "50" } });
    fireEvent.change(screen.getByDisplayValue("350"), { target: { value: "400" } });

    expect(screen.queryByText(ORDER_ERROR)).toBeNull();
    expect(useAppStore.getState().layers[0]?.layer).toMatchObject({
      pianuraMin: -100,
      collinaMin: 50,
      montagnaMin: 400,
    });
  });

  it("7. does not show the ordering error for a blank/NaN intermediate threshold", () => {
    renderDemLayer();
    const collina = screen.getByDisplayValue("250") as HTMLInputElement;
    fireEvent.change(collina, { target: { value: "" } });

    const layer = useAppStore.getState().layers[0]?.layer as DemLayerSpec;
    expect(Number.isNaN(layer.collinaMin)).toBe(true);
    expect(screen.queryByText(ORDER_ERROR)).toBeNull();
  });
});

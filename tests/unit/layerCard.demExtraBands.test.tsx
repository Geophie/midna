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

function demLayer(): DemLayerSpec {
  return useAppStore.getState().layers[0]?.layer as DemLayerSpec;
}

const addLower = () => fireEvent.click(screen.getByRole("button", { name: "+ Add lower elevation class" }));
const addUpper = () => fireEvent.click(screen.getByRole("button", { name: "+ Add higher elevation class" }));

describe("LayerCard DEM extra elevation classes — add / remove / persistence", () => {
  it("1. adds a lower elevation class with a valid default threshold", () => {
    renderDemLayer();
    addLower();

    expect(demLayer().lowerBands).toEqual([{ id: expect.any(String), threshold: -100, weight: 0 }]);
    expect(screen.getByLabelText("Lower elevation 1 Threshold (min elevation)")).toBeTruthy();
    expect(screen.queryByText(ORDER_ERROR)).toBeNull();
  });

  it("2. adds a higher elevation class with a valid default threshold", () => {
    renderDemLayer();
    addUpper();

    expect(demLayer().upperBands).toEqual([{ id: expect.any(String), threshold: 450, weight: 0 }]);
    expect(screen.getByLabelText("Higher elevation 1 Threshold (min elevation)")).toBeTruthy();
    expect(screen.queryByText(ORDER_ERROR)).toBeNull();
  });

  it("3. supports multiple lower and upper classes, each still valid by default", () => {
    renderDemLayer();
    addLower();
    addLower();
    addUpper();
    addUpper();

    expect(demLayer().lowerBands.map((b) => b.threshold)).toEqual([-200, -100]);
    expect(demLayer().upperBands.map((b) => b.threshold)).toEqual([450, 550]);
    // Each label appears twice (threshold column + weight column) — see the
    // aria-label based lookups elsewhere in this file for unambiguous queries.
    expect(screen.getAllByText("Lower elevation 1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Lower elevation 2").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Higher elevation 1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Higher elevation 2").length).toBeGreaterThan(0);
    expect(screen.queryByText(ORDER_ERROR)).toBeNull();
  });

  it("4. removes only the targeted optional class, preserving the others", () => {
    renderDemLayer();
    addLower();
    addLower();

    const [first] = demLayer().lowerBands;
    fireEvent.change(screen.getByLabelText("Lower elevation 1 Threshold (min elevation)"), {
      target: { value: "-90" },
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Remove elevation class" })[0]);

    expect(demLayer().lowerBands).toHaveLength(1);
    expect(demLayer().lowerBands[0].id).not.toBe(first.id);
    // The surviving band (originally "Lower elevation 1", threshold edited to -90) remains.
    expect(demLayer().lowerBands[0].threshold).toBe(-90);
    // Inputs are uncontrolled (defaultValue) — this is the assertion that
    // would catch a React-key regression: the surviving row must still
    // *display* the value the user typed, not just hold it in the store.
    expect(
      (screen.getByLabelText("Lower elevation 1 Threshold (min elevation)") as HTMLInputElement).value,
    ).toBe("-90");
  });

  it("5. core Plain/Hillside/Mountain classes carry no remove control", () => {
    renderDemLayer();
    addLower();
    addUpper();

    // Only the two optional bands are removable — the layer-level "Remove" button is separate.
    expect(screen.getAllByRole("button", { name: "Remove elevation class" })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Remove" })).toBeTruthy();
  });

  it("6. an entered threshold survives state updates", () => {
    renderDemLayer();
    addLower();
    fireEvent.change(screen.getByLabelText("Lower elevation 1 Threshold (min elevation)"), {
      target: { value: "-500" },
    });
    expect(demLayer().lowerBands[0].threshold).toBe(-500);
  });

  it("7. an entered weight survives state updates, including an explicit zero", () => {
    renderDemLayer();
    addLower();
    fireEvent.change(screen.getByLabelText("Lower elevation 1 Weight"), { target: { value: "0.35" } });
    expect(demLayer().lowerBands[0].weight).toBe(0.35);

    fireEvent.change(screen.getByLabelText("Lower elevation 1 Weight"), { target: { value: "0" } });
    expect(demLayer().lowerBands[0].weight).toBe(0);
  });

  it("8. a negative threshold survives on an upper band too", () => {
    renderDemLayer();
    addUpper();
    fireEvent.change(screen.getByLabelText("Higher elevation 1 Threshold (min elevation)"), {
      target: { value: "-10" },
    });
    expect(demLayer().upperBands[0].threshold).toBe(-10);
  });

  it("9. shows the ordering error immediately for an out-of-order extra class, and clears it when fixed", () => {
    renderDemLayer();
    addLower();
    // Default -100 is valid; push it above pianuraMin (0) to break the sequence.
    fireEvent.change(screen.getByLabelText("Lower elevation 1 Threshold (min elevation)"), {
      target: { value: "50" },
    });
    expect(screen.getByRole("alert").textContent).toBe(ORDER_ERROR);

    fireEvent.change(screen.getByLabelText("Lower elevation 1 Threshold (min elevation)"), {
      target: { value: "-100" },
    });
    expect(screen.queryByText(ORDER_ERROR)).toBeNull();
  });

  it("10. rejects an upper band placed below montagnaMin, immediately", () => {
    renderDemLayer();
    addUpper();
    fireEvent.change(screen.getByLabelText("Higher elevation 1 Threshold (min elevation)"), {
      target: { value: "300" },
    });
    expect(screen.getByRole("alert").textContent).toBe(ORDER_ERROR);
  });
});

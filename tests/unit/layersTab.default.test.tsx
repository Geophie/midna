import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LayersTab } from "@/components/tabs/LayersTab";
import { useAppStore } from "@/lib/store";

afterEach(() => {
  cleanup();
  useAppStore.setState({ layers: [], lang: "en" });
});

describe("LayersTab DEM defaults", () => {
  it("creates a 250 m hillside threshold and preserves an explicit override", () => {
    useAppStore.setState({ layers: [], lang: "en" });
    render(<LayersTab />);

    fireEvent.click(screen.getByRole("button", { name: "DEM" }));

    const hillside = screen.getByDisplayValue("250") as HTMLInputElement;
    expect(hillside.value).toBe("250");
    expect(useAppStore.getState().layers[0]?.layer).toMatchObject({
      type: "dem",
      collinaMin: 250,
    });

    fireEvent.change(hillside, { target: { value: "300" } });
    expect(useAppStore.getState().layers[0]?.layer).toMatchObject({
      type: "dem",
      collinaMin: 300,
    });
  });
});

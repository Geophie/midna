import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LayerCard } from "@/components/LayerCard";
import { useAppStore } from "@/lib/store";
import { STRINGS } from "@/lib/i18n";
import type { DemLayerSpec, VectorLayerSpec } from "@/workers/pyodide.worker";

afterEach(() => {
  cleanup();
  useAppStore.setState({ layers: [], lang: "en" });
});

const vectorEntry = (type: "inclusion" | "exclusion") => ({
  id: type,
  layer: {
    type,
    name: type,
    files: [],
    enabled: true,
    intersectWeight: type === "inclusion" ? 1 : 0,
    noIntersectWeight: type === "inclusion" ? 0 : 1,
  } satisfies VectorLayerSpec,
});

const demEntry = {
  id: "dem",
  layer: {
    type: "dem",
    name: "DEM",
    fileName: "",
    fileBytes: new Uint8Array(),
    enabled: true,
    pianuraMin: 0,
    collinaMin: 250,
    montagnaMin: 350,
    lowWeight: 0,
    midWeight: 0,
    highWeight: 0,
    nodataWeight: 0,
    lowerBands: [],
    upperBands: [],
  } satisfies DemLayerSpec,
};

describe("vector weight help text", () => {
  it("I. renders the English copy under inclusion and exclusion weight fields", () => {
    useAppStore.setState({ lang: "en", layers: [] });
    render(
      <>
        <LayerCard entry={vectorEntry("inclusion")} />
        <LayerCard entry={vectorEntry("exclusion")} />
      </>,
    );
    const matches = screen.getAllByText(STRINGS.en.vector_weight_help);
    expect(matches).toHaveLength(2);
  });

  it("J. renders the Italian copy when the language is Italian", () => {
    useAppStore.setState({ lang: "it", layers: [] });
    render(<LayerCard entry={vectorEntry("inclusion")} />);
    expect(screen.getByText(STRINGS.it.vector_weight_help)).toBeTruthy();
  });

  it("does not add the note to a DEM layer card", () => {
    useAppStore.setState({ lang: "en", layers: [] });
    render(<LayerCard entry={demEntry} />);
    expect(screen.queryByText(STRINGS.en.vector_weight_help)).toBeNull();
  });
});

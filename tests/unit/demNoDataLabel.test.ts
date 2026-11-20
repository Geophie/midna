// The UI must say that the "NoData" weight also applies to cells BELOW the
// lowest configured threshold — that is how the core classifies them
// (weights._classifyDemStates: dem_nodata vs dem_below_configured_range).

import { describe, expect, it } from "vitest";
import { STRINGS, t } from "@/lib/i18n";

describe("DEM NoData weight wording", () => {
  it("1. Italian label mentions both NoData and the below-minimum case", () => {
    const label = t("terrain_nodata", "it");
    expect(label).toMatch(/nodata/i);
    expect(label).toMatch(/sotto/i);
  });

  it("2. English label mentions both NoData and the below-minimum case", () => {
    const label = t("terrain_nodata", "en");
    expect(label).toMatch(/nodata/i);
    expect(label).toMatch(/below/i);
  });

  it("3. Italian guide explains that cells below the lowest threshold use that weight", () => {
    expect(t("help_layers_1", "it")).toMatch(/inferiore alla soglia minima/i);
  });

  it("4. English guide explains that cells below the lowest threshold use that weight", () => {
    expect(t("help_layers_1", "en")).toMatch(/below the lowest/i);
  });

  it("5. the label key exists in both languages (no fallback to the key name)", () => {
    expect(STRINGS.it.terrain_nodata).toBeTruthy();
    expect(STRINGS.en.terrain_nodata).toBeTruthy();
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { EvalSummary } from "@/components/EvalSummary";
import { useAppStore } from "@/lib/store";
import { STRINGS } from "@/lib/i18n";
import type { EvalResult } from "@/workers/pyodide.worker";

// EvalSummary reads the UI language from the store via useT(); pin it to "en"
// so assertions match a known string table.
useAppStore.setState({ lang: "en" });

afterEach(cleanup);

const EN = STRINGS.en;

function evalResult(over: Partial<EvalResult>): EvalResult {
  return {
    status: "valid",
    anchor_rank: 42,
    n_cells: 900,
    hit_score_pct: 12.34,
    anchor_score: 55.5,
    distance_to_nearest_cell_m: 0,
    home_guess_distance_m: 8900,
    n_priority_cells: 111,
    search_area_km2: 56.7,
    total_cells: 900,
    eligible_hit_score_pct: 12.34,
    eligible_area_fraction: 1,
    eligible_cells: 900,
    eligible_area_km2: 12.3,
    ...over,
  };
}

const OUT_OF_DOMAIN = evalResult({
  status: "out_of_domain",
  anchor_rank: null,
  hit_score_pct: null,
  anchor_score: null,
  distance_to_nearest_cell_m: 1234.5,
  home_guess_distance_m: null,
  n_priority_cells: null,
  search_area_km2: null,
  eligible_hit_score_pct: null,
  eligible_area_fraction: 0.62,
  eligible_cells: 558,
});

const ANCHOR_EXCLUDED = evalResult({
  status: "anchor_excluded",
  anchor_rank: null,
  hit_score_pct: null,
  anchor_score: null,
  home_guess_distance_m: null,
  n_priority_cells: null,
  search_area_km2: null,
  eligible_hit_score_pct: null,
  eligible_area_fraction: 0.44,
  eligible_cells: 396,
});

const VALID = evalResult({});

function rowsOf(container: HTMLElement) {
  return [...container.querySelectorAll("div")].map((d) => d.textContent ?? "");
}

// OutputTab renders both the baseline and enhanced card with `showEligible`, so
// the same metric rows line up horizontally across the two. Every case here
// therefore passes `showEligible`.

// ---------------------------------------------------------------------------
// Findings 1 & 2 — invalid anchor states still render safely.
// ---------------------------------------------------------------------------
describe("EvalSummary — out_of_domain", () => {
  it("renders without throwing, shows the warning, blanks unavailable metrics, keeps the nearest-cell diagnostic", () => {
    const { container } = render(
      <EvalSummary label="Enhanced" gini={0.5} evalResult={OUT_OF_DOMAIN} showEligible />
    );
    const text = container.textContent ?? "";
    const rows = rowsOf(container);
    expect(text).toContain(EN.eval_status_out_of_domain);
    expect(rows.find((r) => r.startsWith(EN.result_hit_score_full_aoi))).toContain("—");
    expect(rows.find((r) => r.startsWith(EN.result_eligible_hit_score))).toContain("—");
    expect(rows.find((r) => r.startsWith(EN.result_search_area))).toContain("—");
    expect(rows.find((r) => r.startsWith(EN.result_distance))).toContain("—");
    expect(text).toContain(EN.result_nearest_cell_distance);
    expect(text).toContain("1.23 km");
    expect(text).toContain("50.00%"); // gini
    // eligible-area fraction stays meaningful even when the anchor is out of domain
    expect(rows.find((r) => r.startsWith(EN.result_eligible_area))).toContain("62.0%");
  });
});

describe("EvalSummary — anchor_excluded", () => {
  it("shows the exclusion warning, blanks HSP metrics, keeps eligible-area, hides the nearest-cell row", () => {
    const { container } = render(
      <EvalSummary label="Enhanced" gini={0.9} evalResult={ANCHOR_EXCLUDED} showEligible />
    );
    const text = container.textContent ?? "";
    const rows = rowsOf(container);
    expect(text).toContain(EN.eval_status_anchor_excluded);
    expect(text).not.toContain(EN.eval_status_out_of_domain);
    expect(text).not.toContain(EN.result_nearest_cell_distance);
    expect(rows.find((r) => r.startsWith(EN.result_hit_score_full_aoi))).toContain("—");
    expect(rows.find((r) => r.startsWith(EN.result_eligible_hit_score))).toContain("—");
    expect(rows.find((r) => r.startsWith(EN.result_eligible_area))).toContain("44.0%");
  });
});

describe("EvalSummary — valid", () => {
  it("shows no warning and formats every metric", () => {
    const { container } = render(
      <EvalSummary label="Baseline" gini={0.5} evalResult={VALID} showEligible />
    );
    const text = container.textContent ?? "";
    expect(text).not.toContain(EN.eval_status_out_of_domain);
    expect(text).not.toContain(EN.eval_status_anchor_excluded);
    expect(text).toContain("12.34%");
    expect(text).toContain("56.70 km²");
    expect(text).toContain("8.90 km");
    expect(text).not.toContain("—");
    // the explainer paragraph lives in OutputTab, not the card
    expect(text).not.toContain(EN.eval_eligible_help);
  });
});

// ---------------------------------------------------------------------------
// Finding 3 — full-AOI vs eligible-domain rows.
// ---------------------------------------------------------------------------
describe("EvalSummary — Finding 3, valid with contraction", () => {
  it("shows Full-AOI + Eligible-domain Hit Score + Eligible area", () => {
    const r = evalResult({ hit_score_pct: 28.0, eligible_hit_score_pct: 41.5, eligible_area_fraction: 0.5 });
    const { container } = render(
      <EvalSummary label="Enhanced" gini={0.6} evalResult={r} showEligible />
    );
    const text = container.textContent ?? "";
    const rows = rowsOf(container);
    expect(text).toContain(EN.result_hit_score_full_aoi);
    expect(rows.find((x) => x.startsWith(EN.result_hit_score_full_aoi))).toContain("28.00%");
    expect(rows.find((x) => x.startsWith(EN.result_eligible_hit_score))).toContain("41.50%");
    expect(rows.find((x) => x.startsWith(EN.result_eligible_area))).toContain("50.0%");
  });
});

describe("EvalSummary — Finding 3, all cells eligible", () => {
  it("eligible-domain HSP equals full-AOI HSP and eligible area is 100%", () => {
    const r = evalResult({ hit_score_pct: 19.0, eligible_hit_score_pct: 19.0, eligible_area_fraction: 1 });
    const { container } = render(
      <EvalSummary label="Enhanced" gini={0.3} evalResult={r} showEligible />
    );
    const rows = rowsOf(container);
    expect(rows.find((x) => x.startsWith(EN.result_hit_score_full_aoi))).toContain("19.00%");
    expect(rows.find((x) => x.startsWith(EN.result_eligible_hit_score))).toContain("19.00%");
    expect(rows.find((x) => x.startsWith(EN.result_eligible_area))).toContain("100.0%");
  });
});

// ---------------------------------------------------------------------------
// Row alignment — baseline and enhanced cards emit the same labelled rows in
// the same order, so matching metrics line up horizontally.
// ---------------------------------------------------------------------------
describe("EvalSummary — baseline/enhanced row alignment", () => {
  it("both cards emit the same ordered label set when valid", () => {
    const labelSet = (r: EvalResult) => {
      const { container } = render(<EvalSummary label="x" gini={0.5} evalResult={r} showEligible />);
      const labels = [...container.querySelectorAll("div > span:first-child")].map((s) => s.textContent);
      cleanup();
      return labels;
    };
    const baseline = labelSet(evalResult({ eligible_hit_score_pct: 12.34, eligible_area_fraction: 1 }));
    const enhanced = labelSet(evalResult({ hit_score_pct: 20, eligible_hit_score_pct: 30, eligible_area_fraction: 0.5 }));
    expect(baseline).toEqual([
      EN.result_hit_score_full_aoi,
      EN.result_eligible_hit_score,
      EN.result_eligible_area,
      EN.result_search_area,
      EN.result_gini,
      EN.result_distance,
    ]);
    expect(enhanced).toEqual(baseline);
  });
});

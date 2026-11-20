"use client";

import { useForm, useWatch } from "react-hook-form";
import { useEffect, useState } from "react";
import type { ParamsFormValues } from "@/lib/paramsSchema";
import { parseLocaleFloat } from "@/lib/parseLocaleFloat";
import { getPyodideApi } from "@/lib/pyodideClient";
import { DEFAULT_ANALYSIS_CRS, useAppStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { Toggle } from "@/components/ui/Toggle";

const inputClass =
  "rounded-lg border border-border bg-background px-3 py-1.5 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-accent sm:text-sm";

type CrsWarningState = "geographic" | "projected" | "invalid" | "unknown";

const fallbackCrsState = (crs: string): CrsWarningState =>
  crs === DEFAULT_ANALYSIS_CRS.code && DEFAULT_ANALYSIS_CRS.isGeographic ? "geographic" : "unknown";

export function ParamsForm() {
  const t = useT();
  const params = useAppStore((s) => s.params);
  const setParams = useAppStore((s) => s.setParams);
  const disabled = useAppStore((s) => s.status === "running" || s.status === "loading-engine");
  const gridFileName = useAppStore((s) => s.gridFileName);

  const { register, control, setValue } = useForm<ParamsFormValues>({
    defaultValues: params,
  });

  // useWatch, not watch(): the React Compiler cannot memoize watch() safely.
  // Every field is present via defaultValues, so the full shape holds.
  const watched = useWatch({ control }) as ParamsFormValues;

  // Params are validated only when the user starts the analysis (see
  // page.tsx's handleRun) — showing schema errors live under each field
  // would flash false positives while a value is still mid-edit (e.g. "0,0"
  // before the user finishes typing "0,02").
  useEffect(() => {
    setParams(watched);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(watched)]);

  const bAuto = watched.bAuto;
  const analysisCrs = watched.analysisCrs;
  const useOutliers = watched.useOutliers;
  const useNormalize = watched.useNormalize;
  const useGini = watched.useGini;
  const engine = watched.engine;
  const gridDisabled = disabled || Boolean(gridFileName);
  // The inspection result is stored with the CRS it belongs to; until the
  // current CRS has been inspected, the fallback state is derived in render.
  const [crsInspection, setCrsInspection] = useState<{ crs: string; state: CrsWarningState } | null>(null);
  const crsWarningState =
    crsInspection?.crs === analysisCrs ? crsInspection.state : fallbackCrsState(analysisCrs);

  useEffect(() => {
    const inspectedCrs = analysisCrs;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      getPyodideApi()
        .inspectAnalysisCrs(inspectedCrs)
        .then((inspection) => {
          if (cancelled) return;
          setCrsInspection({
            crs: inspectedCrs,
            state: !inspection.valid ? "invalid" : inspection.isGeographic ? "geographic" : "projected",
          });
        })
        .catch((error) => {
          if (cancelled) return;
          // Advisory inspection must never classify an unknown CRS as projected
          // or interfere with the normal analysis path.
          console.error("[crs] advisory inspection failed", error);
          setCrsInspection({ crs: inspectedCrs, state: fallbackCrsState(inspectedCrs) });
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [analysisCrs]);

  const gridFileSuffix = gridFileName ? (
    <span className="text-xs text-foreground-muted"> {t("cells_from_custom_grid_suffix")}</span>
  ) : null;

  return (
    <fieldset disabled={disabled} className="grid grid-cols-2 gap-4 text-sm">
      <label className="flex flex-col gap-1">
        {t("param_engine_label")}
        <select className={inputClass} {...register("engine")}>
          <option value="numpy">{t("engine_numpy")}</option>
          <option value="loop">{t("engine_loop")}</option>
        </select>
        {engine === "loop" && (
          <span className="text-xs text-foreground-muted">{t("engine_loop_warning")}</span>
        )}
      </label>
      <div />
      <label className="flex flex-col gap-1">
        {t("lat_col")}
        <input className={inputClass} {...register("latCol")} />
      </label>
      <label className="flex flex-col gap-1">
        {t("lon_col")}
        <input className={inputClass} {...register("lonCol")} />
      </label>
      <label className="flex flex-col gap-1">
        {t("crs_input")}
        <input className={inputClass} {...register("inputCrs")} />
      </label>
      <label className="flex flex-col gap-1">
        {t("crs_output")}
        <input className={inputClass} {...register("analysisCrs")} />
      </label>
      {crsWarningState === "geographic" && (
        <div role="alert" className="col-span-2 rounded-lg border border-amber-600 bg-amber-50 px-3 py-2 text-sm text-foreground dark:border-amber-400 dark:bg-amber-950/30">
          <p className="font-medium">{t("crs_geographic_warning_title")}</p>
          <p>{t("crs_geographic_warning_body")}</p>
        </div>
      )}
      <label className="flex flex-col gap-1">
        {t("param_cells_x")}
        {gridFileSuffix}
        <input
          type="text"
          inputMode="decimal"
          className={inputClass}
          disabled={gridDisabled}
          {...register("cellsX", { setValueAs: parseLocaleFloat })}
        />
      </label>
      <label className="flex flex-col gap-1">
        {t("param_cells_y")}
        {gridFileSuffix}
        <input
          type="text"
          inputMode="decimal"
          className={inputClass}
          disabled={gridDisabled}
          {...register("cellsY", { setValueAs: parseLocaleFloat })}
        />
      </label>
      <label className="col-span-2 flex flex-col gap-1">
        {t("param_aoi_padding")}
        {gridFileSuffix}
        <input
          type="text"
          inputMode="decimal"
          className={inputClass}
          disabled={gridDisabled}
          {...register("aoiPaddingPct", { setValueAs: parseLocaleFloat })}
        />
      </label>
      <label className="flex flex-col gap-1">
        {t("param_f")}
        <input
          type="text"
          inputMode="decimal"
          className={inputClass}
          {...register("f", { setValueAs: parseLocaleFloat })}
        />
      </label>
      <label className="flex flex-col gap-1">
        {t("param_g")}
        <input
          type="text"
          inputMode="decimal"
          className={inputClass}
          {...register("g", { setValueAs: parseLocaleFloat })}
        />
      </label>
      <label className="flex flex-col gap-1">
        {t("param_k")}
        <input
          type="text"
          inputMode="decimal"
          className={inputClass}
          {...register("k", { setValueAs: parseLocaleFloat })}
        />
      </label>
      <div className="mt-6 flex items-center">
        <Toggle
          checked={bAuto}
          onChange={(checked) => setValue("bAuto", checked, { shouldValidate: true })}
          disabled={disabled}
          label={t("b_auto_label")}
        />
      </div>
      {!bAuto && (
        <label className="flex flex-col gap-1">
          {t("b_manual_label")}
          <input
            type="text"
            inputMode="decimal"
            className={inputClass}
            {...register("bValue", { setValueAs: parseLocaleFloat })}
          />
        </label>
      )}
      <div className="mt-2 flex items-center">
        <Toggle
          checked={useOutliers}
          onChange={(checked) => setValue("useOutliers", checked, { shouldValidate: true })}
          disabled={disabled}
          label={t("outlier_removal")}
        />
      </div>
      {useOutliers && (
        <label className="flex flex-col gap-1">
          {t("outlier_threshold_label")}
          <input
            type="text"
            inputMode="decimal"
            className={inputClass}
            {...register("outlierThresholdMultiplier", { setValueAs: parseLocaleFloat })}
          />
        </label>
      )}
      <div className="mt-2 flex items-center">
        <Toggle
          checked={useNormalize}
          onChange={(checked) => setValue("useNormalize", checked, { shouldValidate: true })}
          disabled={disabled}
          label={t("normalize")}
        />
      </div>
      <div className="mt-2 flex items-center">
        <Toggle
          checked={useGini}
          onChange={(checked) => setValue("useGini", checked, { shouldValidate: true })}
          disabled={disabled}
          label={t("calc_gini")}
        />
      </div>
    </fieldset>
  );
}

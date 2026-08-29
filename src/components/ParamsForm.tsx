"use client";

import { useForm } from "react-hook-form";
import { useEffect } from "react";
import type { ParamsFormValues } from "@/lib/paramsSchema";
import { parseLocaleFloat } from "@/lib/parseLocaleFloat";
import { useAppStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { Toggle } from "@/components/ui/Toggle";

const inputClass =
  "rounded-lg border border-border bg-background px-3 py-1.5 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-accent sm:text-sm";

export function ParamsForm() {
  const t = useT();
  const params = useAppStore((s) => s.params);
  const setParams = useAppStore((s) => s.setParams);
  const disabled = useAppStore((s) => s.status === "running" || s.status === "loading-engine");
  const gridFileName = useAppStore((s) => s.gridFileName);

  const { register, watch, setValue } = useForm<ParamsFormValues>({
    defaultValues: params,
  });

  const watched = watch();

  // Params are validated only when the user starts the analysis (see
  // page.tsx's handleRun) — showing schema errors live under each field
  // would flash false positives while a value is still mid-edit (e.g. "0,0"
  // before the user finishes typing "0,02").
  useEffect(() => {
    setParams(watched);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(watched)]);

  const bAuto = watch("bAuto");
  const useOutliers = watch("useOutliers");
  const useNormalize = watch("useNormalize");
  const useGini = watch("useGini");
  const engine = watch("engine");
  const gridDisabled = disabled || Boolean(gridFileName);
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

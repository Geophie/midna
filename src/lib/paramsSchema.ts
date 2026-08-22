import { z } from "zod";

export const paramsSchema = z
  .object({
    latCol: z.string().min(1, "error_csv_columns"),
    lonCol: z.string().min(1, "error_csv_columns"),
    inputCrs: z.string().min(1, "error_invalid_crs"),
    analysisCrs: z.string().min(1, "error_invalid_crs"),
    cellsX: z.number().int().positive("error_grid_cells_positive"),
    cellsY: z.number().int().positive("error_grid_cells_positive"),
    f: z.number().positive("error_rossmo_params"),
    g: z.number().positive("error_rossmo_params"),
    k: z.number().positive("error_rossmo_params"),
    bAuto: z.boolean(),
    bValue: z.number(),
    engine: z.enum(["numpy", "loop"]),
    useOutliers: z.boolean(),
    outlierThresholdMultiplier: z.number().positive("error_hub_dist_threshold"),
    useNormalize: z.boolean(),
    useGini: z.boolean(),
  })
  .refine((data) => data.bAuto || data.bValue > 0, {
    message: "error_rossmo_params",
    path: ["bValue"],
  });

export type ParamsFormValues = z.infer<typeof paramsSchema>;

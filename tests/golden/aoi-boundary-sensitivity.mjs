import { loadPyodide } from "pyodide";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..");
const core = path.join(root, "public", "py", "core");
const pipeline = path.join(root, "public", "py", "webcore", "pipeline.py");
const fixture = path.join(root, "tests", "e2e", "fixtures", "atlanta-crimes-26.csv");
const coreFiles = [
  "aoi.py",
  "buffer_zone.py",
  "grid.py",
  "outliers.py",
  "rossmo_numpy.py",
  "rossmo_loop.py",
  "weights.py",
  "normalize.py",
  "ranking.py",
  "evaluation.py",
  "stats.py",
];

async function main() {
  const pyodide = await loadPyodide();
  await pyodide.loadPackage(["numpy", "pandas", "geopandas", "shapely"]);
  pyodide.FS.mkdirTree("/core");
  pyodide.FS.mkdirTree("/webcore");
  for (const file of coreFiles) {
    pyodide.FS.writeFile(`/core/${file}`, fs.readFileSync(path.join(core, file), "utf8"));
  }
  pyodide.FS.writeFile("/webcore/pipeline.py", fs.readFileSync(pipeline, "utf8"));
  pyodide.FS.writeFile("/atlanta-crimes-26.csv", fs.readFileSync(fixture, "utf8"));

  const result = JSON.parse(await pyodide.runPythonAsync(`
import json, sys
for directory in ("/", "/webcore"):
    if directory not in sys.path:
        sys.path.insert(0, directory)

import numpy as np
import geopandas as gpd
import core.aoi as aoi
import core.buffer_zone as buffer_zone
import core.grid as grid
import core.rossmo_numpy as rossmo_numpy
import core.stats as stats
import pipeline

# Controlled fixture and production defaults: EPSG:4326, 200x200, f=g=1.2,
# k=1, automatic B, no outlier removal, no weights. HSP is unavailable because
# this fixture has no independently supplied anchor point.
df = aoi.loadCrimesCsv("/atlanta-crimes-26.csv", "Latitude", "Longitude")
crimes = gpd.GeoDataFrame(
    df,
    geometry=gpd.points_from_xy(df["Longitude"], df["Latitude"]),
    crs="EPSG:4326",
)
crimes_xy = np.array([(point.x, point.y) for point in crimes.geometry])
B = float(buffer_zone.computeBufferZone(crimes_xy))
base_cells_x = 200
base_cells_y = 200
base_aoi = aoi.computeAoiFromGdf(crimes, bufferPct=0.10)
base_minx, base_miny, base_maxx, base_maxy = base_aoi.total_bounds
base_cell_width = (base_maxx - base_minx) / base_cells_x
base_cell_height = (base_maxy - base_miny) / base_cells_y

def deterministic_cells(size, baseline_cell_size):
    # Half-up avoids Python's banker's rounding and makes this harness stable.
    return int(np.floor(size / baseline_cell_size + 0.5))

def edge_values(raw, cells_x, cells_y):
    surface = raw.reshape(cells_y, cells_x)
    mask = np.zeros(surface.shape, dtype=bool)
    mask[[0, -1], :] = True
    mask[:, [0, -1]] = True
    return surface[mask]

def normalized(raw):
    raw_min, raw_max = float(raw.min()), float(raw.max())
    max_only = np.zeros_like(raw) if raw_max <= 0 else raw / raw_max * 100
    min_max = np.zeros_like(raw) if raw_max == raw_min else (raw - raw_min) / (raw_max - raw_min) * 100
    return max_only, min_max

runs = []
scored_by_padding = {}
for padding_pct in (10, 25, 50, 100):
    aoi_gdf = aoi.computeAoiFromGdf(crimes, bufferPct=padding_pct / 100)
    minx, miny, maxx, maxy = aoi_gdf.total_bounds
    width, height = maxx - minx, maxy - miny
    cells_x = deterministic_cells(width, base_cell_width)
    cells_y = deterministic_cells(height, base_cell_height)
    grid_gdf = grid.createGrid(aoi_gdf, cells_x, cells_y)
    scored = rossmo_numpy.rossmoNumpy(grid_gdf, crimes_xy, B, 1.2, 1.2, 1.0)
    raw = scored.sort_values("cell_id")["score"].to_numpy(dtype=float)
    diagnostics = pipeline._boundary_diagnostics(scored, cells_x, cells_y)
    edge = edge_values(raw, cells_x, cells_y)
    max_only, min_max = normalized(raw)
    max_only_edge, min_max_edge = edge_values(max_only, cells_x, cells_y), edge_values(min_max, cells_x, cells_y)
    top = scored.loc[scored["score"].idxmax()]
    centroid = top.geometry.centroid
    raw_min, raw_max = float(raw.min()), float(raw.max())
    runs.append({
        "padding_pct": padding_pct,
        "bounds": [float(minx), float(miny), float(maxx), float(maxy)],
        "width": float(width),
        "height": float(height),
        "cells_x": cells_x,
        "cells_y": cells_y,
        "n_cells": int(len(scored)),
        "cell_width": float(width / cells_x),
        "cell_height": float(height / cells_y),
        "crime_count_used": int(len(crimes)),
        "outliers_removed": 0,
        "b": B,
        "peak_raw": diagnostics["peak_raw"],
        "edge_max_raw": diagnostics["edge_max_raw"],
        "edge_mean_raw": diagnostics["edge_mean_raw"],
        "edge_p95_raw": diagnostics["edge_p95_raw"],
        "edge_peak_ratio": diagnostics["edge_peak_ratio"],
        "raw_min": raw_min,
        "raw_max": raw_max,
        "raw_min_max_ratio": raw_min / raw_max if raw_max else None,
        "top_ranked_cell": {"cell_id": int(top.cell_id), "longitude": float(centroid.x), "latitude": float(centroid.y)},
        "hsp": None,
        "gini": float(stats.computeGini(raw)),
        "normalization": {
            "max_only_edge_max": float(max_only_edge.max()),
            "min_max_edge_max": float(min_max_edge.max()),
            "max_only_edge_mean": float(max_only_edge.mean()),
            "min_max_edge_mean": float(min_max_edge.mean()),
        },
    })
    scored_by_padding[padding_pct] = scored

def coordinate_score_map(scored):
    return {
        (round(float(cell.geometry.centroid.x), 12), round(float(cell.geometry.centroid.y), 12)): float(cell.score)
        for _, cell in scored.iterrows()
    }

baseline_scores = coordinate_score_map(scored_by_padding[10])
shared_region = {}
for padding_pct in (25, 50, 100):
    candidate_scores = coordinate_score_map(scored_by_padding[padding_pct])
    shared = baseline_scores.keys() & candidate_scores.keys()
    differences = [abs(baseline_scores[key] - candidate_scores[key]) for key in shared]
    peak = max(baseline_scores.values())
    shared_region[str(padding_pct)] = {
        "matched_centroids": len(shared),
        "baseline_centroids": len(baseline_scores),
        "max_abs_difference": max(differences) if differences else None,
        "relative_max_difference": max(differences) / peak if differences else None,
    }

json.dumps({"runs": runs, "shared_region": shared_region})
`));

  let ok = true;
  const fail = (message) => {
    console.error(`FAIL: ${message}`);
    ok = false;
  };
  const expectedCells = [200, 250, 333, 500];
  for (const [index, run] of result.runs.entries()) {
    if (run.cells_x !== expectedCells[index] || run.cells_y !== expectedCells[index]) {
      fail(`${run.padding_pct}% cells=${run.cells_x}x${run.cells_y}`);
    }
    if (run.n_cells !== run.cells_x * run.cells_y || run.edge_peak_ratio === null) {
      fail(`${run.padding_pct}% invalid grid or diagnostics`);
    }
  }
  for (const padding of ["25", "100"]) {
    const comparison = result.shared_region[padding];
    if (comparison.matched_centroids !== 40_000 || comparison.relative_max_difference > 1e-10) {
      fail(`${padding}% shared-region scores diverged: ${JSON.stringify(comparison)}`);
    }
  }
  if (!ok) process.exit(1);
  console.log(JSON.stringify(result, null, 2));
  console.log("AOI boundary sensitivity verification passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import * as Comlink from "comlink";
import type { PyodideWorkerApi } from "@/workers/pyodide.worker";

let api: Comlink.Remote<PyodideWorkerApi> | null = null;

export function getPyodideApi(): Comlink.Remote<PyodideWorkerApi> {
  if (typeof window === "undefined") {
    throw new Error("getPyodideApi can only be called in the browser");
  }
  if (!api) {
    // Pre-bundled by scripts/build-worker.mjs (esbuild), served as a static
    // asset. Next.js's bundlers (both Turbopack and webpack) do not reliably
    // emit a true ES module worker chunk for `new Worker(new URL(...))` —
    // Turbopack serves the raw unbundled .ts source, and webpack silently
    // downgrades `{ type: "module" }` to classic (requires
    // `experiments.outputModule`, which Next does not enable). Pyodide
    // itself refuses to run inside a classic worker, so we bypass both
    // bundlers' worker heuristics entirely for this one file.
    const worker = new Worker("/pyodide-worker.js", { type: "module" });
    api = Comlink.wrap<PyodideWorkerApi>(worker);
  }
  return api;
}

import esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

await esbuild.build({
  entryPoints: [path.join(root, "src", "workers", "pyodide.worker.ts")],
  outfile: path.join(root, "public", "pyodide-worker.js"),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  external: ["/pyodide/pyodide.mjs"],
  logLevel: "info",
});

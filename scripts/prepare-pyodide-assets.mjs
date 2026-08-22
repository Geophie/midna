import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

const CORE_RUNTIME_FILES = [
  "pyodide.asm.mjs",
  "pyodide.asm.wasm",
  "pyodide.mjs",
  "pyodide-lock.json",
  "python_stdlib.zip",
];

const PACKAGE_WHEEL_PREFIXES = [
  "numpy-",
  "pandas-",
  "geopandas-",
  "shapely-",
  "fiona-",
  "pyproj-",
  "rasterio-",
  "affine-",
  "attrs-",
  "certifi-",
  "click-",
  "cligj-",
  "packaging-",
  "pyparsing-",
  "python_dateutil-",
  "pytz-",
  "setuptools-",
  "six-",
];

function sourceDirs() {
  return [
    path.join(root, "node_modules", "pyodide"),
    path.join(root, "spike", "node_modules", "pyodide"),
  ].filter((dir) => fs.existsSync(path.join(dir, "pyodide.asm.wasm")));
}

function main() {
  const dirs = sourceDirs();
  if (dirs.length === 0) {
    throw new Error(
      "No pyodide runtime found in node_modules or spike/node_modules. Run `npm install` first."
    );
  }
  const dest = path.join(root, "public", "pyodide");
  fs.mkdirSync(dest, { recursive: true });

  let copied = 0;

  for (const file of CORE_RUNTIME_FILES) {
    const from = dirs.map((d) => path.join(d, file)).find((p) => fs.existsSync(p));
    if (!from) {
      console.warn(`skip missing core file: ${file}`);
      continue;
    }
    fs.copyFileSync(from, path.join(dest, file));
    copied++;
  }

  const seen = new Set();
  for (const dir of dirs) {
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".whl") || seen.has(file)) continue;
      if (!PACKAGE_WHEEL_PREFIXES.some((p) => file.startsWith(p))) continue;
      fs.copyFileSync(path.join(dir, file), path.join(dest, file));
      seen.add(file);
      copied++;
    }
  }

  console.log(`Copied ${copied} pyodide asset files into public/pyodide/ (sources: ${dirs.join(", ")})`);
}

main();

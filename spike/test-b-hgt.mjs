import { loadPyodide } from "pyodide";

function makeHgtBuffer(side) {
  const buf = Buffer.alloc(side * side * 2);
  for (let i = 0; i < side * side; i++) {
    buf.writeInt16BE((i % 500) - 100, i * 2);
  }
  return buf;
}

const pyodide = await loadPyodide();
await pyodide.loadPackage(["rasterio"]);

const hgtSide = 1201;
pyodide.FS.writeFile("/N00E000.hgt", makeHgtBuffer(hgtSide));

const out = await pyodide.runPythonAsync(`
import zipfile
import rasterio

with rasterio.open("/N00E000.hgt") as src:
    shape_plain = (src.height, src.width)
    driver_plain = src.driver

with zipfile.ZipFile("/N00E000.zip", "w") as zf:
    zf.write("/N00E000.hgt", arcname="N00E000.hgt")

with rasterio.open("/vsizip//N00E000.zip/N00E000.hgt") as src:
    shape_zipped = (src.height, src.width)
    driver_zipped = src.driver

f"plain driver={driver_plain} shape={shape_plain}; zipped driver={driver_zipped} shape={shape_zipped}"
`);
console.log("RESULT:", out);

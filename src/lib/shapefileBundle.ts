import { readFileBytes } from "@/lib/readFileBytes";

export interface VectorFileEntry {
  name: string;
  bytes: Uint8Array;
}

export interface ShapefileBundleResult {
  bundle: VectorFileEntry[];
  warning: string | null;
  warningVars?: Record<string, string | number>;
}

export interface ShapefileBundleError {
  error: string;
  errorVars?: Record<string, string | number>;
}

const SIDECAR_EXTENSIONS = new Set(["shp", "shx", "dbf", "prj", "cpg"]);

function extOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot + 1).toLowerCase();
}

function basenameOf(fileName: string): string {
  const slash = Math.max(fileName.lastIndexOf("/"), fileName.lastIndexOf("\\"));
  const base = slash === -1 ? fileName : fileName.slice(slash + 1);
  const dot = base.lastIndexOf(".");
  return (dot === -1 ? base : base.slice(0, dot)).toLowerCase();
}

/**
 * Groups a raw shapefile-part selection (from a folder pick or a manual
 * multi-select) by basename and picks the one group that actually contains
 * a .shp. Never called for a single GeoJSON/.zip pick — those are already
 * a valid 1-entry bundle on their own.
 */
export function buildShapefileBundle(
  files: File[]
): Promise<ShapefileBundleResult | ShapefileBundleError> {
  const groups = new Map<string, File[]>();
  for (const file of files) {
    const path = "webkitRelativePath" in file && file.webkitRelativePath ? file.webkitRelativePath : file.name;
    const ext = extOf(path);
    if (!SIDECAR_EXTENSIONS.has(ext)) continue;
    const key = basenameOf(path);
    const group = groups.get(key) ?? [];
    group.push(file);
    groups.set(key, group);
  }

  const shpGroups = [...groups.entries()].filter(([, group]) => group.some((f) => extOf(f.name) === "shp"));

  if (shpGroups.length === 0) {
    return Promise.resolve({ error: "shapefile_error_no_shp" });
  }
  if (shpGroups.length > 1) {
    return Promise.resolve({
      error: "shapefile_error_multiple",
      errorVars: { count: shpGroups.length },
    });
  }

  const [, group] = shpGroups[0];
  const hasShx = group.some((f) => extOf(f.name) === "shx");
  const hasDbf = group.some((f) => extOf(f.name) === "dbf");
  if (!hasShx || !hasDbf) {
    const missing = [!hasShx && ".shx", !hasDbf && ".dbf"].filter(Boolean).join(", ");
    return Promise.resolve({
      error: "shapefile_error_missing_sidecars",
      errorVars: { missing },
    });
  }

  const ignoredCount = files.length - group.length;

  return Promise.all(
    group.map(async (file) => ({
      name: file.name,
      bytes: await readFileBytes(file),
    }))
  ).then((bundle) => ({
    bundle,
    warning: ignoredCount > 0 ? "shapefile_files_ignored" : null,
    warningVars: ignoredCount > 0 ? { count: ignoredCount } : undefined,
  }));
}

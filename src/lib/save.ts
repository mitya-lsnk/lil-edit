import { save } from "@tauri-apps/plugin-dialog";
import { writeFileBytes } from "./fsx";
import { hasTauri } from "./tauri";

/** Join with whichever separator the directory already uses. */
export function joinPath(dir: string, name: string): string {
  const sep = dir.includes("\\") && !dir.includes("/") ? "\\" : "/";
  return dir.endsWith(sep) ? dir + name : dir + sep + name;
}

/**
 * Open a native Save dialog and write bytes. Returns the path, or null if
 * cancelled.
 *
 * `dir` is the folder of the image the user opened: pre-filling it there is
 * what people expect — the result lands next to the original instead of in
 * whatever folder the dialog remembered last.
 */
export async function saveBytes(
  data: ArrayBuffer | Uint8Array,
  defaultName: string,
  ext: string,
  dir?: string | null,
): Promise<string | null> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);

  if (!hasTauri()) {
    // Browser preview: hand it to the download manager.
    const url = URL.createObjectURL(new Blob([bytes as BlobPart]));
    const a = document.createElement("a");
    a.href = url;
    a.download = defaultName;
    a.click();
    URL.revokeObjectURL(url);
    return defaultName;
  }

  const path = await save({
    defaultPath: dir ? joinPath(dir, defaultName) : defaultName,
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
  });
  if (!path) return null;
  await writeFileBytes(path, bytes);
  return path;
}

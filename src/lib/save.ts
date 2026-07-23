import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

/** Open a native Save dialog and write bytes. Returns the path, or null if cancelled. */
export async function saveBytes(
  data: ArrayBuffer | Uint8Array,
  defaultName: string,
  ext: string,
): Promise<string | null> {
  const path = await save({
    defaultPath: defaultName,
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
  });
  if (!path) return null;
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  await writeFile(path, bytes);
  return path;
}

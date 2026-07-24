import { invoke } from "@tauri-apps/api/core";

/**
 * Read/write through Rust rather than the fs plugin: the plugin's capability
 * scope is anchored to $HOME, so images on a second drive (D:\photos\…) fail.
 * Paths here always come from a native dialog or a drop the user performed.
 */
export async function readFileBytes(path: string): Promise<Uint8Array> {
  // Rust hands this back as an ipc::Response, i.e. a raw ArrayBuffer.
  const buf: ArrayBuffer = await invoke("read_file_bytes", { path });
  return new Uint8Array(buf);
}

export function writeFileBytes(path: string, data: Uint8Array): Promise<void> {
  return invoke("write_file_bytes", { path, data: Array.from(data) });
}

import { invoke } from "@tauri-apps/api/core";

/**
 * Read/write through Rust rather than the fs plugin: the plugin's capability
 * scope is anchored to $HOME, so images on a second drive (D:\photos\…) fail.
 * Paths here always come from a native dialog or a drop the user performed.
 *
 * Both directions move bytes as a raw ArrayBuffer rather than a JSON array of
 * numbers — see `src-tauri/src/ipcx.rs` for what that costs at image sizes.
 */
export async function readFileBytes(path: string): Promise<Uint8Array> {
  // Rust hands this back as an ipc::Response, i.e. a raw ArrayBuffer.
  const buf: ArrayBuffer = await invoke("read_file_bytes", { path });
  return new Uint8Array(buf);
}

export function writeFileBytes(path: string, data: Uint8Array): Promise<void> {
  // The path rides in a header, and headers are ASCII-only — percent-encode it
  // and let the Rust side decode. Paths here are routinely Cyrillic.
  return invoke("write_file_bytes", toArrayBuffer(data), {
    headers: { "x-path": encodeURIComponent(path) },
  });
}

/** An ArrayBuffer holding exactly `data`, avoiding a copy when it already does. */
function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  if (data.byteOffset === 0 && data.byteLength === data.buffer.byteLength) {
    return data.buffer as ArrayBuffer;
  }
  return data.slice().buffer as ArrayBuffer;
}

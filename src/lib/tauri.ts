/** True when running inside the Tauri desktop shell (Rust backend available). */
export function hasTauri(): boolean {
  return (
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  );
}

import { invoke } from "@tauri-apps/api/core";
import { hasTauri } from "./tauri";

/** What the backend tells us about the latest GitHub release. */
export interface UpdateInfo {
  /** The latest release is strictly newer than the running build. */
  available: boolean;
  current: string;
  latest: string;
  /** Release notes (may be empty). */
  notes: string;
  /** Release page — the download fallback. */
  url: string;
  /** Direct macOS download (.dmg when published), else null. */
  asset: string | null;
}

/**
 * Ask GitHub (via the Rust side) whether a newer release exists. Throws on a
 * network / API error so the caller can tell "up to date" from "couldn't
 * check"; the silent startup check just swallows that.
 */
export async function checkUpdate(): Promise<UpdateInfo> {
  if (!hasTauri()) throw new Error("no-tauri");
  return await invoke<UpdateInfo>("check_update");
}

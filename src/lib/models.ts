import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface ModelStatus {
  id: string;
  name: string;
  category: "background" | "upscale";
  description: string;
  url: string;
  size: string;
  homepage: string;
  license: string;
  tag: string;
  downloaded: boolean;
  path: string | null;
}

export interface ModelProgress {
  id: string;
  downloaded: number;
  total: number;
  phase: "download" | "extract" | "done" | "cancelled";
}

export function listModels(): Promise<ModelStatus[]> {
  return invoke("list_models");
}

export function downloadModel(id: string): Promise<void> {
  return invoke("download_model", { id });
}

/** Ask an in-flight download to stop; temp files are cleaned up by the backend. */
export function cancelDownload(id: string): Promise<void> {
  return invoke("cancel_download", { id });
}

export function deleteModel(id: string): Promise<void> {
  return invoke("delete_model", { id });
}

export function modelsDirPath(): Promise<string> {
  return invoke("models_dir_path");
}

export interface ModelsLocation {
  /** The folder in use right now. */
  dir: string;
  /** The built-in location under app data. */
  defaultDir: string;
  /** A "models" folder next to the .exe, or null when that isn't writable. */
  appDir: string | null;
  /** True when `dir` is a user override. */
  custom: boolean;
  bytes: number;
}

export function modelsLocation(): Promise<ModelsLocation> {
  return invoke("models_location");
}

/** `dir: null` restores the default location. */
export function setModelsDir(
  dir: string | null,
  moveExisting: boolean,
): Promise<ModelsLocation> {
  return invoke("set_models_dir", { dir, moveExisting });
}

export interface CacheInfo {
  dir: string;
  bytes: number;
  installed: number;
}

export function cacheInfo(): Promise<CacheInfo> {
  return invoke("cache_info");
}

/** Deletes all downloaded models; resolves with bytes freed. */
export function clearCache(): Promise<number> {
  return invoke("clear_cache");
}

export function onModelProgress(
  cb: (p: ModelProgress) => void,
): Promise<UnlistenFn> {
  return listen<ModelProgress>("model:progress", (e) => cb(e.payload));
}

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
  phase: "download" | "extract" | "done";
}

export function listModels(): Promise<ModelStatus[]> {
  return invoke("list_models");
}

export function downloadModel(id: string): Promise<void> {
  return invoke("download_model", { id });
}

export function deleteModel(id: string): Promise<void> {
  return invoke("delete_model", { id });
}

export function modelsDirPath(): Promise<string> {
  return invoke("models_dir_path");
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

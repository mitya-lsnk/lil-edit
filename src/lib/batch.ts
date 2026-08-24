// Batch processing: run one operation over every image in a folder, writing
// each result into a destination folder. Reuses the same processing paths as
// the single-image tools (jSquash compress, ncnn upscale, ONNX bg, canvas
// resize). App-only — it reads and writes real folders through Rust.

import { invoke } from "@tauri-apps/api/core";
import { readFileBytes, writeFileBytes } from "./fsx";
import { joinPath } from "./save";
import { compressFile, FORMAT_META, type OutputFormat } from "./compress";
import { upscaleImage, removeBackground } from "./ai";
import {
  loadImageFromFile,
  imageToCanvas,
  resizeCanvas,
  canvasToPngBytes,
} from "./edit";

export type BatchOpId = "upscale" | "background" | "compress" | "resize";

export interface BatchSettings {
  op: BatchOpId;
  // compress
  format: OutputFormat;
  quality: number;
  // upscale
  engineId: string;
  modelValue: string;
  scale: number;
  denoise: number;
  // background
  bgModelId: string;
  // resize
  percent: number;
}

export interface BatchPaths {
  source: string;
  dest: string;
  /** When true, the two paths are remembered across restarts. */
  remember: boolean;
}

export interface BatchProgress {
  done: number;
  total: number;
  current: string;
}

export interface BatchError {
  name: string;
  error: string;
}

const PATHS_KEY = "liledit.batch.paths";
const SET_KEY = "liledit.batch.settings";

const DEFAULT_PATHS: BatchPaths = { source: "", dest: "", remember: false };

const DEFAULT_SETTINGS: BatchSettings = {
  op: "upscale",
  format: "mozjpeg",
  quality: 75,
  engineId: "upscayl-ncnn",
  modelValue: "upscayl-standard-4x",
  scale: 4,
  denoise: 1,
  bgModelId: "u2netp",
  percent: 50,
};

export function loadPaths(): BatchPaths {
  try {
    const raw = localStorage.getItem(PATHS_KEY);
    if (raw) return { ...DEFAULT_PATHS, ...JSON.parse(raw) };
  } catch {
    /* ignore malformed */
  }
  return { ...DEFAULT_PATHS };
}

export function savePaths(p: BatchPaths): void {
  try {
    localStorage.setItem(PATHS_KEY, JSON.stringify(p));
  } catch {
    /* ignore quota */
  }
}

export function clearPaths(): void {
  try {
    localStorage.removeItem(PATHS_KEY);
  } catch {
    /* ignore */
  }
}

export function loadSettings(): BatchSettings {
  try {
    const raw = localStorage.getItem(SET_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s: BatchSettings): void {
  try {
    localStorage.setItem(SET_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/** Full paths of the image files directly inside `dir` (non-recursive). */
export function listFolderImages(dir: string): Promise<string[]> {
  return invoke<string[]>("list_dir_images", { dir });
}

export function baseName(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

function mimeFromName(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    avif: "image/avif",
    gif: "image/gif",
    bmp: "image/bmp",
    tif: "image/tiff",
    tiff: "image/tiff",
  };
  return map[ext] ?? "application/octet-stream";
}

// Produce the output bytes for one file under the chosen operation, plus the
// filename suffix and extension to save it as.
async function runOp(
  file: File,
  st: BatchSettings,
): Promise<{ bytes: Uint8Array; ext: string; suffix: string }> {
  switch (st.op) {
    case "compress": {
      const r = await compressFile(file, {
        format: st.format,
        quality: st.quality,
      });
      return {
        bytes: new Uint8Array(r.bytes),
        ext: FORMAT_META[st.format].ext,
        suffix: "min",
      };
    }
    case "upscale": {
      const blob = await upscaleImage(file, {
        engine: st.engineId,
        scale: st.scale,
        modelName: st.modelValue,
        denoise: st.denoise,
      });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      return { bytes, ext: "png", suffix: `x${st.scale}` };
    }
    case "background": {
      const blob = await removeBackground(file, st.bgModelId);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      return { bytes, ext: "png", suffix: "nobg" };
    }
    case "resize": {
      const img = await loadImageFromFile(file);
      const c = imageToCanvas(img);
      const f = Math.max(1, st.percent) / 100;
      const out = resizeCanvas(
        c,
        Math.round(c.width * f),
        Math.round(c.height * f),
      );
      const bytes = await canvasToPngBytes(out);
      return { bytes, ext: "png", suffix: `r${st.percent}` };
    }
    default:
      throw new Error(`unknown batch op: ${st.op}`);
  }
}

/**
 * Process `paths` one at a time into `dest`. Calls `onProgress` before each file
 * and once more at the end; stops early (between files) when `isCancelled()`
 * returns true. Never throws — per-file failures are collected and returned.
 */
export async function runBatch(
  paths: string[],
  dest: string,
  st: BatchSettings,
  onProgress: (p: BatchProgress) => void,
  isCancelled: () => boolean,
): Promise<{ ok: number; errors: BatchError[] }> {
  const errors: BatchError[] = [];
  let ok = 0;
  for (let i = 0; i < paths.length; i++) {
    if (isCancelled()) break;
    const name = baseName(paths[i]);
    onProgress({ done: i, total: paths.length, current: name });
    try {
      const bytes = await readFileBytes(paths[i]);
      const file = new File([bytes as BlobPart], name, {
        type: mimeFromName(name),
      });
      const { bytes: out, ext, suffix } = await runOp(file, st);
      const base = name.replace(/\.[^.]+$/, "");
      await writeFileBytes(joinPath(dest, `${base}-${suffix}.${ext}`), out);
      ok++;
    } catch (e) {
      errors.push({ name, error: String(e) });
    }
  }
  onProgress({ done: paths.length, total: paths.length, current: "" });
  return { ok, errors };
}

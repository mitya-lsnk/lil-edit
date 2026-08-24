import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { readFileBytes } from "./fsx";
import { hasTauri } from "./tauri";

/** A loaded image plus, in the desktop app, where it came from on disk. */
export interface Picked {
  file: File;
  /** Absolute path of the original, or null in the browser. */
  path: string | null;
}

export const IMAGE_EXTS = [
  "png",
  "jpg",
  "jpeg",
  "webp",
  "avif",
  "gif",
  "bmp",
  "tif",
  "tiff",
];

const MIME: Record<string, string> = {
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

/** Split a native path into directory and file name (handles \ and /). */
export function splitPath(path: string): { dir: string; name: string } {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  if (i < 0) return { dir: "", name: path };
  let dir = path.slice(0, i);
  // A file at the root of a drive leaves "D:", which Windows reads as
  // "current directory on D:" rather than "D:\" — keep the separator.
  if (/^[A-Za-z]:$/.test(dir)) dir += "\\";
  return { dir, name: path.slice(i + 1) };
}

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i + 1).toLowerCase();
}

function isImagePath(path: string): boolean {
  return IMAGE_EXTS.includes(extOf(path));
}

/** Read a file off disk (through Rust, so any drive works) into a File. */
async function loadPath(path: string): Promise<Picked> {
  const { name } = splitPath(path);
  const bytes = await readFileBytes(path);
  const type = MIME[extOf(name)] ?? "application/octet-stream";
  return { file: new File([bytes as BlobPart], name, { type }), path };
}

/**
 * Open the picker. Uses the native dialog in the app so we learn the path.
 * `filterName` is the localized label for the image filter (this module runs
 * outside React, so the caller passes the translated string in).
 */
export async function pickImage(filterName = "Images"): Promise<Picked | null> {
  if (!hasTauri()) return null;
  const path = await open({
    multiple: false,
    directory: false,
    filters: [{ name: filterName, extensions: IMAGE_EXTS }],
  });
  if (typeof path !== "string") return null;
  return loadPath(path);
}

/**
 * Subscribe to file drops.
 *
 * In the app this is Tauri's native drag-drop (`dragDropEnabled` in
 * tauri.conf.json) — the only route that hands us a real path, which is what
 * lets Save default to the original's folder. In a plain browser it falls back
 * to HTML5 drops, where no path exists. The preventDefault calls there are
 * load-bearing: without them the page navigates to the dropped file.
 */
export function onImageDrop(
  cb: (picked: Picked) => void,
  onError?: (message: string) => void,
): () => void {
  if (hasTauri()) {
    let unlisten: UnlistenFn | null = null;
    let dead = false;
    getCurrentWebview()
      .onDragDropEvent(async (e) => {
        if (e.payload.type !== "drop") return;
        const path = e.payload.paths.find(isImagePath);
        if (!path) return;
        try {
          cb(await loadPath(path));
        } catch (err) {
          onError?.(String(err));
        }
      })
      .then((un) => {
        if (dead) un();
        else unlisten = un;
      });
    return () => {
      dead = true;
      unlisten?.();
    };
  }

  const swallowDrop = (e: DragEvent) => e.preventDefault();
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    const img = Array.from(e.dataTransfer?.files ?? []).find((f) =>
      f.type.startsWith("image/"),
    );
    if (img) cb({ file: img, path: null });
  };
  window.addEventListener("dragenter", swallowDrop);
  window.addEventListener("dragover", swallowDrop);
  window.addEventListener("drop", onDrop);
  return () => {
    window.removeEventListener("dragenter", swallowDrop);
    window.removeEventListener("dragover", swallowDrop);
    window.removeEventListener("drop", onDrop);
  };
}

/**
 * Subscribe to files handed to us from outside — Finder, or "Open in lil edit"
 * from lil view.
 *
 * Two sources, and both are needed. A cold launch delivers the path to Rust
 * before React has mounted, so it is buffered there and drained here on mount;
 * every later hand-off arrives while we're running and comes through the
 * `open-files` event.
 */
export function onOpenedFiles(
  cb: (picked: Picked) => void,
  onError?: (message: string) => void,
): () => void {
  if (!hasTauri()) return () => {};

  let dead = false;
  const accept = async (paths: string[]) => {
    const path = paths.find(isImagePath);
    if (!path || dead) return;
    try {
      const picked = await loadPath(path);
      if (!dead) cb(picked);
    } catch (err) {
      if (!dead) onError?.(String(err));
    }
  };

  void invoke<string[]>("take_pending_open").then(accept).catch(() => {});

  let unlisten: UnlistenFn | null = null;
  void listen<string[]>("open-files", (e) => void accept(e.payload)).then((un) => {
    if (dead) un();
    else unlisten = un;
  });

  return () => {
    dead = true;
    unlisten?.();
  };
}

/**
 * Track whether something is being dragged over the window. Only needed in the
 * app: with native drag-drop on, the webview never sees dragover, so the
 * dropzone's highlight has to come from Tauri's own events.
 */
export function onDragHover(cb: (over: boolean) => void): () => void {
  if (!hasTauri()) return () => {};
  let unlisten: UnlistenFn | null = null;
  let dead = false;
  getCurrentWebview()
    .onDragDropEvent((e) => cb(e.payload.type === "over"))
    .then((un) => {
      if (dead) un();
      else unlisten = un;
    });
  return () => {
    dead = true;
    unlisten?.();
  };
}

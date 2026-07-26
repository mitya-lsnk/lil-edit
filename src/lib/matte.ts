// Edge post-processing for the background-removal result. The model gives us one
// fixed alpha matte; these are the "ComfyUI-style" tweaks applied *after* it, all
// on a <canvas>: harden the cutoff, grow/shrink the mask, feather the edge.
//
// We keep the RGB of the *original* image and only swap in the adjusted alpha, so
// growing the mask reveals real pixels instead of a black fringe.

import { canvasToPngBytes, loadImageFromFile } from "./edit";

export interface EdgeSettings {
  /** 0..100 — push semi-transparent pixels toward fully kept / fully cut. */
  hardness: number;
  /** -12..12 px — dilate (grow, >0) or erode (shrink, <0) the mask. */
  grow: number;
  /** 0..12 px — blur the mask edge for a softer cutout. */
  feather: number;
}

export const DEFAULT_EDGE: EdgeSettings = { hardness: 0, grow: 0, feather: 0 };

export function edgeIsIdentity(e: EdgeSettings): boolean {
  return e.hardness === 0 && e.grow === 0 && e.feather === 0;
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not decode the mask."));
    };
    img.src = url;
  });
}

/** Separable min/max filter — the building block of erode (min) / dilate (max). */
function morph(
  a: Float32Array,
  w: number,
  h: number,
  r: number,
  dilate: boolean,
): Float32Array {
  const pick = dilate ? Math.max : Math.min;
  const tmp = new Float32Array(a.length);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let v = a[row + x];
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w - 1, x + r);
      for (let xx = x0; xx <= x1; xx++) v = pick(v, a[row + xx]);
      tmp[row + x] = v;
    }
  }
  const out = new Float32Array(a.length);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let v = tmp[y * w + x];
      const y0 = Math.max(0, y - r);
      const y1 = Math.min(h - 1, y + r);
      for (let yy = y0; yy <= y1; yy++) v = pick(v, tmp[yy * w + x]);
      out[y * w + x] = v;
    }
  }
  return out;
}

/** One horizontal box-blur pass with a running sum and clamped edges. */
function boxH(a: Float32Array, w: number, h: number, r: number): Float32Array {
  const out = new Float32Array(a.length);
  const win = 2 * r + 1;
  const clamp = (x: number) => (x < 0 ? 0 : x > w - 1 ? w - 1 : x);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let sum = 0;
    for (let x = -r; x <= r; x++) sum += a[row + clamp(x)];
    for (let x = 0; x < w; x++) {
      out[row + x] = sum / win;
      sum += a[row + clamp(x + r + 1)] - a[row + clamp(x - r)];
    }
  }
  return out;
}

/** One vertical box-blur pass. */
function boxV(a: Float32Array, w: number, h: number, r: number): Float32Array {
  const out = new Float32Array(a.length);
  const win = 2 * r + 1;
  const clamp = (y: number) => (y < 0 ? 0 : y > h - 1 ? h - 1 : y);
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -r; y <= r; y++) sum += a[clamp(y) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / win;
      sum += a[clamp(y + r + 1) * w + x] - a[clamp(y - r) * w + x];
    }
  }
  return out;
}

/** Two box passes per axis approximate a gaussian well enough for a matte. */
function blur(a: Float32Array, w: number, h: number, r: number): Float32Array {
  let s = a;
  for (let pass = 0; pass < 2; pass++) {
    s = boxH(s, w, h, r);
    s = boxV(s, w, h, r);
  }
  return s;
}

/**
 * Re-cut `originalFile` using the model's `maskPng` alpha, adjusted by `edge`.
 * Order: grow/shrink → harden → feather. Returns PNG bytes.
 */
export async function applyMatte(
  originalFile: File,
  maskPng: Uint8Array,
  edge: EdgeSettings,
): Promise<Uint8Array> {
  const orig = await loadImageFromFile(originalFile);
  const w = orig.naturalWidth;
  const h = orig.naturalHeight;

  const base = document.createElement("canvas");
  base.width = w;
  base.height = h;
  const bctx = base.getContext("2d");
  if (!bctx) throw new Error("2D canvas is unavailable.");
  bctx.drawImage(orig, 0, 0);
  const baseData = bctx.getImageData(0, 0, w, h);

  // Draw the mask at the original's resolution (handles any size mismatch).
  const maskImg = await loadImageFromBlob(
    new Blob([maskPng as BlobPart], { type: "image/png" }),
  );
  const mc = document.createElement("canvas");
  mc.width = w;
  mc.height = h;
  const mctx = mc.getContext("2d");
  if (!mctx) throw new Error("2D canvas is unavailable.");
  mctx.drawImage(maskImg, 0, 0, w, h);
  const maskData = mctx.getImageData(0, 0, w, h).data;

  let a = new Float32Array(w * h);
  for (let i = 0; i < a.length; i++) a[i] = maskData[i * 4 + 3] / 255;

  if (edge.grow !== 0) {
    a = morph(a, w, h, Math.abs(edge.grow), edge.grow > 0);
  }
  if (edge.hardness > 0) {
    // k=1 leaves alpha untouched; k→∞ snaps it to a hard 0/1 threshold at 0.5.
    const k = 1 / (1 - Math.min(edge.hardness / 100, 0.99));
    for (let i = 0; i < a.length; i++) {
      const v = (a[i] - 0.5) * k + 0.5;
      a[i] = v < 0 ? 0 : v > 1 ? 1 : v;
    }
  }
  if (edge.feather > 0) {
    a = blur(a, w, h, edge.feather);
  }

  const out = baseData.data;
  for (let i = 0; i < a.length; i++) out[i * 4 + 3] = Math.round(a[i] * 255);
  bctx.putImageData(baseData, 0, 0);

  return canvasToPngBytes(base);
}

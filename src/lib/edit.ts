// Client-side raster editing — crop, resize, rotate, flip — all on a <canvas>,
// so it works the same in the Tauri app and in a plain browser (no Rust, no
// models). Every op takes the current canvas and returns a new one, which keeps
// an undo stack trivial: each step is just another canvas.

/** A crop rectangle in normalised [0..1] coordinates, relative to the source. */
export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Load a File into an <img>, resolving once it has decoded. */
export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not decode this image."));
    };
    img.src = url;
  });
}

function make(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function ctxOf(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2D canvas is unavailable.");
  return ctx;
}

/** Rasterise a decoded image into a fresh canvas at its natural size. */
export function imageToCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const c = make(img.naturalWidth, img.naturalHeight);
  ctxOf(c).drawImage(img, 0, 0);
  return c;
}

export function cropCanvas(src: HTMLCanvasElement, r: CropRect): HTMLCanvasElement {
  const sx = Math.round(r.x * src.width);
  const sy = Math.round(r.y * src.height);
  const sw = Math.max(1, Math.round(r.w * src.width));
  const sh = Math.max(1, Math.round(r.h * src.height));
  const out = make(sw, sh);
  ctxOf(out).drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);
  return out;
}

export function resizeCanvas(
  src: HTMLCanvasElement,
  w: number,
  h: number,
): HTMLCanvasElement {
  const out = make(w, h);
  const ctx = ctxOf(out);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, out.width, out.height);
  return out;
}

export function rotateCanvas(
  src: HTMLCanvasElement,
  deg: 90 | -90 | 180,
): HTMLCanvasElement {
  if (deg === 180) {
    const out = make(src.width, src.height);
    const ctx = ctxOf(out);
    ctx.translate(out.width, out.height);
    ctx.rotate(Math.PI);
    ctx.drawImage(src, 0, 0);
    return out;
  }
  // 90°: width and height swap.
  const out = make(src.height, src.width);
  const ctx = ctxOf(out);
  if (deg === 90) {
    ctx.translate(out.width, 0);
    ctx.rotate(Math.PI / 2);
  } else {
    ctx.translate(0, out.height);
    ctx.rotate(-Math.PI / 2);
  }
  ctx.drawImage(src, 0, 0);
  return out;
}

export function flipCanvas(
  src: HTMLCanvasElement,
  axis: "h" | "v",
): HTMLCanvasElement {
  const out = make(src.width, src.height);
  const ctx = ctxOf(out);
  if (axis === "h") {
    ctx.translate(out.width, 0);
    ctx.scale(-1, 1);
  } else {
    ctx.translate(0, out.height);
    ctx.scale(1, -1);
  }
  ctx.drawImage(src, 0, 0);
  return out;
}

export function canvasToPngBytes(c: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    c.toBlob((b) => {
      if (!b) {
        reject(new Error("PNG encoding failed."));
        return;
      }
      b.arrayBuffer().then((a) => resolve(new Uint8Array(a)), reject);
    }, "image/png");
  });
}

export async function canvasToPngFile(
  c: HTMLCanvasElement,
  name: string,
): Promise<File> {
  const bytes = await canvasToPngBytes(c);
  return new File([bytes as BlobPart], name, { type: "image/png" });
}

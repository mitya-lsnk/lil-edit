// Image compression built on jSquash WASM codecs (the same codecs squoosh.app uses).
//
// Decoding uses the browser (createImageBitmap) so we accept anything the webview
// can read (jpeg/png/webp/gif/bmp/avif). Encoding uses jSquash so we get real,
// quality-controlled output — MozJPEG, WebP, AVIF, and OxiPNG.

export type OutputFormat = "mozjpeg" | "webp" | "avif" | "oxipng";

export interface EncodeOptions {
  format: OutputFormat;
  /** 1–100 for lossy formats. Ignored by oxipng. */
  quality: number;
  /** Optional longest-edge cap; image is scaled down if larger. */
  maxDimension?: number;
}

export const FORMAT_META: Record<
  OutputFormat,
  { label: string; ext: string; mime: string; lossy: boolean }
> = {
  mozjpeg: { label: "JPEG (MozJPEG)", ext: "jpg", mime: "image/jpeg", lossy: true },
  webp: { label: "WebP", ext: "webp", mime: "image/webp", lossy: true },
  avif: { label: "AVIF", ext: "avif", mime: "image/avif", lossy: true },
  oxipng: { label: "PNG (OxiPNG)", ext: "png", mime: "image/png", lossy: false },
};

/** Decode a File to ImageData, optionally downscaling and flattening onto a matte. */
export async function decodeToImageData(
  file: Blob,
  maxDimension?: number,
  matte?: string,
): Promise<ImageData> {
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;

  if (maxDimension && Math.max(width, height) > maxDimension) {
    const scale = maxDimension / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  // Formats without alpha (JPEG) must be flattened onto a matte, otherwise
  // transparent pixels become black. WebP/AVIF/PNG keep their alpha.
  if (matte) {
    ctx.fillStyle = matte;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return ctx.getImageData(0, 0, width, height);
}

/** Encode ImageData to the chosen format, returning the compressed bytes. */
export async function encodeImageData(
  image: ImageData,
  opts: EncodeOptions,
): Promise<ArrayBuffer> {
  const q = Math.min(100, Math.max(1, Math.round(opts.quality)));
  switch (opts.format) {
    case "mozjpeg": {
      const { encode } = await import("@jsquash/jpeg");
      // At high quality, disable chroma subsampling (4:4:4) so coloured edges
      // stay crisp instead of smearing. Below that, 4:2:0 saves more bytes.
      return encode(image, {
        quality: q,
        auto_subsample: false,
        chroma_subsample: q >= 85 ? 1 : 2,
      } as any);
    }
    case "webp": {
      const { encode } = await import("@jsquash/webp");
      return encode(image, { quality: q });
    }
    case "avif": {
      const { encode } = await import("@jsquash/avif");
      // jSquash AVIF takes quality 0–100 (higher = better).
      return encode(image, { quality: q });
    }
    case "oxipng": {
      const { encode } = await import("@jsquash/png");
      const png = await encode(image);
      const mod: any = await import("@jsquash/oxipng");
      const optimise = mod.default ?? mod.optimise;
      // level 2 is a good speed/size tradeoff; 6 is max.
      return optimise(png, { level: 3 });
    }
  }
}

export interface CompressResult {
  bytes: ArrayBuffer;
  blob: Blob;
  width: number;
  height: number;
  size: number;
  format: OutputFormat;
  ms: number;
}
// Deliberately no `url` here. Minting an object URL at the point of *creation*
// makes it nobody's job to revoke: a blob URL pins the whole blob in memory
// until it is released, and batch mode calls this once per file in a folder.
// Callers that need to display the result derive the URL in an effect and
// revoke it in the cleanup — see CompressPanel.

/** Full pipeline: decode → (resize) → encode. */
export async function compressFile(
  file: Blob,
  opts: EncodeOptions,
): Promise<CompressResult> {
  const start = performance.now();
  // JPEG has no alpha — flatten onto white so transparency doesn't turn black.
  const matte = opts.format === "mozjpeg" ? "#ffffff" : undefined;
  const image = await decodeToImageData(file, opts.maxDimension, matte);
  const bytes = await encodeImageData(image, opts);
  const meta = FORMAT_META[opts.format];
  const blob = new Blob([bytes], { type: meta.mime });
  return {
    bytes,
    blob,
    width: image.width,
    height: image.height,
    size: bytes.byteLength,
    format: opts.format,
    ms: Math.round(performance.now() - start),
  };
}

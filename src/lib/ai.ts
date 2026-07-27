import { invoke } from "@tauri-apps/api/core";

/**
 * Image bytes cross the IPC boundary as a raw ArrayBuffer in both directions —
 * `invoke(cmd, arrayBuffer, { headers })` on the way in, `ipc::Response` on the
 * way out. The obvious `Array.from(new Uint8Array(buf))` turns a 50 MB PNG into
 * fifty million boxed numbers plus the JSON text for them; next to that,
 * everything else these calls do is free.
 */
function toBlob(buf: ArrayBuffer, mime: string): Blob {
  return new Blob([buf], { type: mime });
}

export async function removeBackground(
  file: Blob,
  modelId: string,
): Promise<Blob> {
  const out = await invoke<ArrayBuffer>(
    "remove_background",
    await file.arrayBuffer(),
    { headers: { "x-model": modelId } },
  );
  return toBlob(out, "image/png");
}

export interface UpscaleOpts {
  /** Registry id of the engine: upscayl-ncnn | realesrgan-ncnn | waifu2x-ncnn. */
  engine: string;
  scale: number;
  modelName: string;
  /** waifu2x denoise level (-1…3); ignored by the Real-ESRGAN engines. */
  denoise: number;
}

export async function upscaleImage(
  file: Blob,
  opts: UpscaleOpts,
): Promise<Blob> {
  const out = await invoke<ArrayBuffer>(
    "upscale_image",
    await file.arrayBuffer(),
    {
      headers: {
        "x-engine": opts.engine,
        "x-model": opts.modelName,
        "x-scale": String(opts.scale),
        "x-denoise": String(opts.denoise),
      },
    },
  );
  return toBlob(out, "image/png");
}

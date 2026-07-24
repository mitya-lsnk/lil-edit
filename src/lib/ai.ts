import { invoke } from "@tauri-apps/api/core";

async function fileToBytes(file: Blob): Promise<number[]> {
  const buf = await file.arrayBuffer();
  return Array.from(new Uint8Array(buf));
}

function toBlob(bytes: number[], mime: string): Blob {
  return new Blob([new Uint8Array(bytes)], { type: mime });
}

export async function removeBackground(
  file: Blob,
  modelId: string,
): Promise<Blob> {
  const image = await fileToBytes(file);
  const out: number[] = await invoke("remove_background", { image, modelId });
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
  const image = await fileToBytes(file);
  const out: number[] = await invoke("upscale_image", { image, ...opts });
  return toBlob(out, "image/png");
}

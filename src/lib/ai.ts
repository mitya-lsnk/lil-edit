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

export async function upscaleImage(
  file: Blob,
  scale: number,
  modelName: string,
): Promise<Blob> {
  const image = await fileToBytes(file);
  const out: number[] = await invoke("upscale_image", {
    image,
    scale,
    modelName,
  });
  return toBlob(out, "image/png");
}

// The upscale engine/model registry, shared by the single-image Upscale panel
// and the batch queue. Ids must match the entries in src-tauri/src/models.rs.

export interface EngineModel {
  value: string;
  /** Scales this model can actually produce. */
  scales: number[];
}

export interface EngineDef {
  id: string;
  short: string;
  models: EngineModel[];
  /** waifu2x takes a denoise level; the ESRGAN-family engines don't. */
  denoise: boolean;
}

export const FOUR = [2, 3, 4];

// Ordered by what we'd pick for someone with all three installed.
export const ENGINES: EngineDef[] = [
  {
    id: "upscayl-ncnn",
    short: "Upscayl",
    denoise: false,
    models: [
      { value: "upscayl-standard-4x", scales: FOUR },
      { value: "remacri-4x", scales: FOUR },
      { value: "ultrasharp-4x", scales: FOUR },
      { value: "digital-art-4x", scales: FOUR },
      { value: "upscayl-lite-4x", scales: FOUR },
    ],
  },
  {
    id: "realesrgan-ncnn",
    short: "Real-ESRGAN",
    denoise: false,
    models: [
      { value: "realesrgan-x4plus", scales: FOUR },
      { value: "realesrgan-x4plus-anime", scales: FOUR },
      { value: "realesr-animevideov3", scales: FOUR },
    ],
  },
  {
    id: "waifu2x-ncnn",
    short: "waifu2x",
    denoise: true,
    models: [
      // Only cunet ships a noise-only (scale 1) model; the upconv sets are 2x-native.
      { value: "models-cunet", scales: [1, 2, 4, 8] },
      { value: "models-upconv_7_anime_style_art_rgb", scales: [2, 4, 8] },
      { value: "models-upconv_7_photo", scales: [2, 4, 8] },
    ],
  },
];

// waifu2x denoise levels; -1 renders as the localized "off".
export const DENOISE = [-1, 0, 1, 2, 3];

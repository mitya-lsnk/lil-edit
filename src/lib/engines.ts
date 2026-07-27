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

/**
 * Only offer scales a model can actually produce.
 *
 * These networks have a fixed factor baked in; `-s` does not pick a different
 * one. The two engines then mishandle a mismatch in opposite ways, and both
 * were visible to the user:
 *
 * - Real-ESRGAN loads `<model>.param` regardless of `-s`, then uses `-s` for
 *   the output buffer size and the tile offsets (`xi * TILE_SIZE_X * scale`).
 *   Asking a 4× network for ×2 wrote every tile at the wrong stride — the
 *   result came out as a mosaic of misaligned blocks.
 * - Upscayl overrides `-s` with a factor parsed out of the model *name*, so
 *   every `…-4x` model silently produced ×4 no matter which button was lit.
 *
 * Only `realesr-animevideov3` ships one file per scale (`-x2/-x3/-x4`), and
 * waifu2x keeps separate model folders per scale, so those get a real choice.
 */
const FOUR_ONLY = [4];

// Ordered by what we'd pick for someone with all three installed.
export const ENGINES: EngineDef[] = [
  {
    id: "upscayl-ncnn",
    short: "Upscayl",
    denoise: false,
    // Every Upscayl weight file is 4×; the name is what sets the factor.
    models: [
      { value: "upscayl-standard-4x", scales: FOUR_ONLY },
      { value: "remacri-4x", scales: FOUR_ONLY },
      { value: "ultrasharp-4x", scales: FOUR_ONLY },
      { value: "digital-art-4x", scales: FOUR_ONLY },
      { value: "upscayl-lite-4x", scales: FOUR_ONLY },
    ],
  },
  {
    id: "realesrgan-ncnn",
    short: "Real-ESRGAN",
    denoise: false,
    models: [
      { value: "realesrgan-x4plus", scales: FOUR_ONLY },
      { value: "realesrgan-x4plus-anime", scales: FOUR_ONLY },
      // The only one here with a weight file per scale.
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

// ---------------------------------------------------------------------------
// Remembered choice
//
// People run the same job repeatedly — the same engine, the same model, the
// same factor. Losing that every time the panel remounts (which happens on any
// trip through Home or another tool) meant re-picking it each time.
// ---------------------------------------------------------------------------

export interface UpscaleChoice {
  engineId: string | null;
  modelValue: string | null;
  scale: number;
  denoise: number;
}

const CHOICE_KEY = "lilimage.upscale.choice";

const DEFAULT_CHOICE: UpscaleChoice = {
  engineId: null,
  modelValue: null,
  scale: 4,
  denoise: 1,
};

export function loadChoice(): UpscaleChoice {
  try {
    const raw = localStorage.getItem(CHOICE_KEY);
    if (raw) return { ...DEFAULT_CHOICE, ...JSON.parse(raw) };
  } catch {
    /* ignore malformed */
  }
  return { ...DEFAULT_CHOICE };
}

export function saveChoice(c: UpscaleChoice): void {
  try {
    localStorage.setItem(CHOICE_KEY, JSON.stringify(c));
  } catch {
    /* ignore quota / private mode */
  }
}

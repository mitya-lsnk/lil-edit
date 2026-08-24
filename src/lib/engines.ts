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
 * What each engine does with a scale its weights weren't trained for — worth
 * knowing before trusting a ×2 or ×3 result, since the two behave differently:
 *
 * - Upscayl parses the factor out of the model *name* and overrides `-s` with
 *   it, so a `…-4x` model always runs at 4×. Self-correcting: it can't produce
 *   a mismatch, but a ×2 request comes back at ×4 dimensions.
 * - Real-ESRGAN has no such inference. It loads `<model>.param` regardless of
 *   `-s` and then uses `-s` for the output buffer and the tile offsets
 *   (`xi * TILE_SIZE_X * scale`), so a 4× network asked for ×2 can write tiles
 *   at the wrong stride.
 *
 * Only realesr-animevideov3 ships a weight file per scale (`-x2/-x3/-x4`), and
 * waifu2x keeps a model folder per scale, so those are unambiguous.
 *
 * Confirmed by testing: on Real-ESRGAN, ×2/×3 come out as a mosaic on both
 * x4plus models and are fine on animevideov3 — exactly what the code above
 * predicts. Those two therefore offer no choice at all, and the UI drops the
 * scale control rather than showing a lone ×4 button.
 */

/** A single fixed factor: the model has one weight file and no alternative. */
const ONLY_4 = [4];

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
      { value: "realesrgan-x4plus", scales: ONLY_4 },
      { value: "realesrgan-x4plus-anime", scales: ONLY_4 },
      // One weight file per scale, so the choice is real here.
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

const CHOICE_KEY = "liledit.upscale.choice";

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

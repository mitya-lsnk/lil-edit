import { useEffect, useMemo, useState } from "react";
import { listModels, type ModelStatus } from "../lib/models";
import { upscaleImage } from "../lib/ai";
import { saveBytes } from "../lib/save";
import { ModelManager } from "./ModelManager";
import { Compare } from "./Compare";
import { formatBytes } from "../lib/format";
import { hasTauri } from "../lib/tauri";

interface Props {
  file: File;
  /** Folder of the original — where the Save dialog should open. */
  srcDir: string | null;
}

interface EngineModel {
  value: string;
  label: string;
  /** Scales this model can actually produce. */
  scales: number[];
}

interface EngineDef {
  /** Registry id — must match the entry in models.rs. */
  id: string;
  short: string;
  models: EngineModel[];
  /** waifu2x takes a denoise level; the ESRGAN-family engines don't. */
  denoise: boolean;
}

const FOUR = [2, 3, 4];

// Ordered by what we'd pick for someone with all three installed.
const ENGINES: EngineDef[] = [
  {
    id: "upscayl-ncnn",
    short: "Upscayl",
    denoise: false,
    models: [
      { value: "upscayl-standard-4x", label: "Стандарт · универсальная", scales: FOUR },
      { value: "remacri-4x", label: "Remacri · фото", scales: FOUR },
      { value: "ultrasharp-4x", label: "UltraSharp · максимум резкости", scales: FOUR },
      { value: "digital-art-4x", label: "Digital Art · рисунки, рендеры", scales: FOUR },
      { value: "upscayl-lite-4x", label: "Lite · быстрая", scales: FOUR },
    ],
  },
  {
    id: "realesrgan-ncnn",
    short: "Real-ESRGAN",
    denoise: false,
    models: [
      { value: "realesrgan-x4plus", label: "General (x4plus)", scales: FOUR },
      { value: "realesrgan-x4plus-anime", label: "Anime (x4plus)", scales: FOUR },
      { value: "realesr-animevideov3", label: "Anime video (v3)", scales: FOUR },
    ],
  },
  {
    id: "waifu2x-ncnn",
    short: "waifu2x",
    denoise: true,
    models: [
      // Only cunet ships a noise-only (scale 1) model; the upconv sets are 2x-native.
      { value: "models-cunet", label: "CUNet · аниме, лучшее качество", scales: [1, 2, 4, 8] },
      {
        value: "models-upconv_7_anime_style_art_rgb",
        label: "UpConv7 · аниме, быстрее",
        scales: [2, 4, 8],
      },
      { value: "models-upconv_7_photo", label: "UpConv7 · фото", scales: [2, 4, 8] },
    ],
  },
];

const DENOISE = [
  { value: -1, label: "нет" },
  { value: 0, label: "0" },
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
];

export function UpscalePanel({ file, srcDir }: Props) {
  const [models, setModels] = useState<ModelStatus[]>([]);
  const [engineId, setEngineId] = useState<string | null>(null);
  const [modelValue, setModelValue] = useState<string | null>(null);
  const [scale, setScale] = useState(4);
  const [denoise, setDenoise] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultBytes, setResultBytes] = useState<Uint8Array | null>(null);
  const [resultUrl, setResultUrl] = useState<string>("");
  const [saved, setSaved] = useState<string | null>(null);

  const [originalUrl, setOriginalUrl] = useState<string>("");
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setOriginalUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    setResultBytes(null);
    setSaved(null);
  }, [file]);
  // Derive the result URL from bytes — single-effect lifecycle is StrictMode-safe.
  useEffect(() => {
    if (!resultBytes) {
      setResultUrl("");
      return;
    }
    const url = URL.createObjectURL(
      new Blob([resultBytes as BlobPart], { type: "image/png" }),
    );
    setResultUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [resultBytes]);

  async function refresh() {
    if (!hasTauri()) return;
    const all = await listModels();
    setModels(all.filter((m) => m.category === "upscale"));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const installed = useMemo(
    () =>
      ENGINES.filter((e) => models.some((m) => m.id === e.id && m.downloaded)),
    [models],
  );

  // Keep the selection valid as engines get installed or removed underneath us.
  const engine =
    installed.find((e) => e.id === engineId) ?? installed[0] ?? null;
  const model =
    engine?.models.find((m) => m.value === modelValue) ?? engine?.models[0];
  const scales = model?.scales ?? FOUR;
  const effScale = scales.includes(scale) ? scale : scales[scales.length - 1];

  if (!hasTauri()) {
    return (
      <div className="t-info">
        <div className="t-info-icon">🖥</div>
        <p>
          <b>Апскейл работает в приложении lil image.</b> Ему нужен движок ncnn
          и GPU через Vulkan — в браузере их нет. Запусти{" "}
          <code>npm run tauri dev</code>.
        </p>
      </div>
    );
  }

  async function run() {
    if (!engine || !model) return;
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const blob = await upscaleImage(file, {
        engine: engine.id,
        scale: effScale,
        modelName: model.value,
        denoise,
      });
      const buf = new Uint8Array(await blob.arrayBuffer());
      setResultBytes(buf);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onSave() {
    if (!resultBytes) return;
    const base = file.name.replace(/\.[^.]+$/, "");
    const path = await saveBytes(
      resultBytes,
      `${base}-x${effScale}.png`,
      "png",
      srcDir,
    );
    if (path) setSaved(path);
  }

  if (!engine) {
    return (
      <div>
        <div className="onboard">
          <div className="onboard-title">Сначала — движок</div>
          <p>
            Апскейл считается на <b>GPU через Vulkan</b> отдельной программой:
            её нужно <b>один раз скачать</b>, дальше всё локально и офлайн.
            Движков три — начните с <b>Upscayl</b>, он самый свежий и с лучшими
            моделями.
          </p>
        </div>
        <ModelManager filter="upscale" onChanged={refresh} />
      </div>
    );
  }

  return (
    <div>
      <div className="t-controls">
        {installed.length > 1 && (
          <div className="t-field">
            <span className="t-label">Движок</span>
            <div className="t-seg">
              {installed.map((e) => (
                <button
                  key={e.id}
                  className={engine.id === e.id ? "active" : ""}
                  onClick={() => {
                    setEngineId(e.id);
                    setModelValue(null);
                  }}
                >
                  {e.short}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="t-field">
          <span className="t-label">Модель</span>
          <select
            className="t-select"
            value={model?.value}
            onChange={(e) => setModelValue(e.target.value)}
          >
            {engine.models.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="t-field">
          <span className="t-label">Масштаб</span>
          <div className="t-seg">
            {scales.map((s) => (
              <button
                key={s}
                className={effScale === s ? "active" : ""}
                onClick={() => setScale(s)}
              >
                ×{s}
              </button>
            ))}
          </div>
        </div>
        {engine.denoise && (
          <div className="t-field">
            <span className="t-label">Шумодав</span>
            <div className="t-seg">
              {DENOISE.map((d) => (
                <button
                  key={d.value}
                  className={denoise === d.value ? "active" : ""}
                  onClick={() => setDenoise(d.value)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <button className="b-btn b-btn--solid" onClick={run} disabled={busy}>
          {busy ? "Апскейл…" : "Увеличить →"}
        </button>
      </div>

      {busy && (
        <p className="t-muted">
          Обработка может занять от секунд до минуты — зависит от размера и GPU.
        </p>
      )}
      {error && <div className="b-error">{error}</div>}

      {resultUrl ? (
        <Compare
          beforeUrl={originalUrl}
          afterUrl={resultUrl}
          beforeLabel="ОРИГИНАЛ"
          afterLabel={`×${effScale}`}
          afterMeta={resultBytes ? formatBytes(resultBytes.length) : undefined}
        />
      ) : (
        <div className="single-view">
          <div className="cmp-img-wrap">
            {originalUrl && <img src={originalUrl} alt="original" />}
          </div>
          <div className="cmp-cap" style={{ borderTop: "3px solid var(--line)" }}>
            <span>ОРИГИНАЛ</span>
          </div>
        </div>
      )}

      {resultUrl && (
        <div className="t-actions">
          <button className="b-btn b-btn--yellow" onClick={onSave}>
            Сохранить PNG ↓
          </button>
          {saved && <span className="t-saved">Сохранено: {saved}</span>}
        </div>
      )}

      <details className="m-details">
        <summary>Движки апскейла</summary>
        <ModelManager filter="upscale" onChanged={refresh} />
      </details>
    </div>
  );
}

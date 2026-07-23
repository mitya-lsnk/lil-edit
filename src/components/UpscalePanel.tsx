import { useEffect, useState } from "react";
import { listModels, type ModelStatus } from "../lib/models";
import { upscaleImage } from "../lib/ai";
import { saveBytes } from "../lib/save";
import { ModelManager } from "./ModelManager";
import { Compare } from "./Compare";
import { formatBytes } from "../lib/format";
import { hasTauri } from "../lib/tauri";

interface Props {
  file: File;
}

const NCNN_MODELS = [
  { value: "realesrgan-x4plus", label: "General (x4plus)" },
  { value: "realesrgan-x4plus-anime", label: "Anime (x4plus)" },
  { value: "realesr-animevideov3", label: "Anime video (v3)" },
];

export function UpscalePanel({ file }: Props) {
  const [models, setModels] = useState<ModelStatus[]>([]);
  const [scale, setScale] = useState(4);
  const [ncnnModel, setNcnnModel] = useState(NCNN_MODELS[0].value);
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
      new Blob([resultBytes], { type: "image/png" }),
    );
    setResultUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [resultBytes]);

  async function refresh() {
    const all = await listModels();
    setModels(all.filter((m) => m.category === "upscale"));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ready = models.some((m) => m.downloaded);

  if (!hasTauri()) {
    return (
      <div className="t-info">
        <div className="t-info-icon">🖥</div>
        <p>
          <b>Апскейл работает в приложении lil image.</b> Ему нужен движок Real-ESRGAN
          и GPU через Vulkan — в браузере их нет. Запусти{" "}
          <code>npm run tauri dev</code>.
        </p>
      </div>
    );
  }

  async function run() {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const blob = await upscaleImage(file, scale, ncnnModel);
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
    const path = await saveBytes(resultBytes, `${base}-x${scale}.png`, "png");
    if (path) setSaved(path);
  }

  if (!ready) {
    return (
      <div>
        <div className="onboard">
          <div className="onboard-title">Сначала — движок</div>
          <p>
            Апскейл использует <b>Real-ESRGAN</b>: бинарник и модели, считает на{" "}
            <b>GPU через Vulkan</b>. Нужно <b>один раз скачать</b> (~49 МБ),
            дальше всё локально и офлайн.
          </p>
        </div>
        <ModelManager filter="upscale" onChanged={refresh} />
      </div>
    );
  }

  return (
    <div>
      <div className="t-controls">
        <div className="t-field">
          <span className="t-label">Модель</span>
          <select
            className="t-select"
            value={ncnnModel}
            onChange={(e) => setNcnnModel(e.target.value)}
          >
            {NCNN_MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="t-field">
          <span className="t-label">Масштаб</span>
          <div className="t-seg">
            {[2, 3, 4].map((s) => (
              <button
                key={s}
                className={scale === s ? "active" : ""}
                onClick={() => setScale(s)}
              >
                ×{s}
              </button>
            ))}
          </div>
        </div>
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
          afterLabel={`×${scale}`}
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
        <summary>Движок апскейла</summary>
        <ModelManager filter="upscale" onChanged={refresh} />
      </details>
    </div>
  );
}

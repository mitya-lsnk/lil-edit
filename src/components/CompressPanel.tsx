import { useEffect, useState } from "react";
import {
  compressFile,
  FORMAT_META,
  type CompressResult,
  type OutputFormat,
} from "../lib/compress";
import { formatBytes, pct } from "../lib/format";
import { saveBytes } from "../lib/save";
import { Compare } from "./Compare";

interface Props {
  file: File;
  /** Folder of the original — where the Save dialog should open. */
  srcDir: string | null;
}

const FORMATS: OutputFormat[] = ["mozjpeg", "webp", "avif", "oxipng"];

export function CompressPanel({ file, srcDir }: Props) {
  const [format, setFormat] = useState<OutputFormat>("mozjpeg");
  const [quality, setQuality] = useState(75);
  const [resize, setResize] = useState(false);
  const [maxDim, setMaxDim] = useState(2000);
  const [result, setResult] = useState<CompressResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  // StrictMode-safe object URL for the original.
  const [originalUrl, setOriginalUrl] = useState<string>("");
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setOriginalUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Reset stale results when the source changes.
  useEffect(() => {
    setResult(null);
    setSaved(null);
    setError(null);
  }, [file]);

  const meta = FORMAT_META[format];
  const lossy = meta.lossy;

  async function run() {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const r = await compressFile(file, {
        format,
        quality,
        maxDimension: resize ? maxDim : undefined,
      });
      setResult((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return r;
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onSave() {
    if (!result) return;
    const base = file.name.replace(/\.[^.]+$/, "");
    const name = `${base}-min.${meta.ext}`;
    try {
      const path = await saveBytes(result.bytes, name, meta.ext, srcDir);
      if (path) setSaved(path);
    } catch (e) {
      setError(String(e));
    }
  }

  const saving = result ? pct(file.size, result.size) : 0;

  return (
    <div>
      <div className="t-controls">
        <div className="t-field">
          <span className="t-label">Формат</span>
          <div className="t-seg">
            {FORMATS.map((f) => (
              <button
                key={f}
                className={format === f ? "active" : ""}
                onClick={() => setFormat(f)}
              >
                {FORMAT_META[f].label.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>

        {lossy && (
          <div className="t-field">
            <span className="t-label">Качество · {quality}</span>
            <input
              className="t-range"
              type="range"
              min={1}
              max={100}
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
            />
          </div>
        )}

        <div className="t-field">
          <span className="t-label">Уменьшить</span>
          <label className="t-check">
            <input
              type="checkbox"
              checked={resize}
              onChange={(e) => setResize(e.target.checked)}
            />
            до
            <input
              type="number"
              className="t-num"
              value={maxDim}
              min={64}
              step={100}
              disabled={!resize}
              onChange={(e) => setMaxDim(Number(e.target.value))}
            />
            px
          </label>
        </div>

        <button className="b-btn b-btn--solid" onClick={run} disabled={busy}>
          {busy ? "Сжимаю…" : "Сжать →"}
        </button>
      </div>

      {error && <div className="b-error">{error}</div>}

      {result ? (
        <Compare
          beforeUrl={originalUrl}
          afterUrl={result.url}
          beforeLabel="ОРИГИНАЛ"
          afterLabel={meta.label.split(" ")[0]}
          beforeMeta={formatBytes(file.size)}
          afterMeta={`${formatBytes(result.size)} · −${saving < 0 ? 0 : saving}% · ${result.ms}ms`}
        />
      ) : (
        <div className="single-view">
          <div className="cmp-img-wrap">
            {originalUrl && <img src={originalUrl} alt="original" />}
          </div>
          <div className="cmp-cap" style={{ borderTop: "3px solid var(--line)" }}>
            <span>ОРИГИНАЛ</span>
            <span>{formatBytes(file.size)}</span>
          </div>
        </div>
      )}

      {result && (
        <div className="t-actions">
          <button className="b-btn b-btn--yellow" onClick={onSave}>
            Сохранить ↓
          </button>
          {saved && <span className="t-saved">Сохранено: {saved}</span>}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState, type CSSProperties } from "react";
import {
  compressFile,
  FORMAT_META,
  type CompressResult,
  type OutputFormat,
} from "../lib/compress";
import { formatBytes, pct } from "../lib/format";
import { saveBytes } from "../lib/save";
import { Compare } from "./Compare";
import { SingleView } from "./SingleView";
import { type Matte } from "../lib/matteBg";
import { PipeButtons } from "./PipeButtons";
import type { Tool } from "./HomeScreen";
import { useStrings } from "../lib/i18n";

interface Props {
  file: File;
  /** Folder of the original — where the Save dialog should open. */
  srcDir: string | null;
  /** Hand the result to another tool as its next input. */
  onSendTo: (file: File, tool: Tool) => void;
  /** Fired with the saved path after a successful save. */
  onSaved: (path: string) => void;
}

const FORMATS: OutputFormat[] = ["mozjpeg", "webp", "avif", "oxipng"];

export function CompressPanel({ file, srcDir, onSendTo, onSaved }: Props) {
  const s = useStrings();
  const [format, setFormat] = useState<OutputFormat>("mozjpeg");
  const [quality, setQuality] = useState(75);
  const [result, setResult] = useState<CompressResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matte, setMatte] = useState<Matte>("theme");

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
    setError(null);
  }, [file]);

  // Derive the preview URL from the result and revoke it on the way out — the
  // single-effect lifecycle is what guarantees it, whether the result is
  // replaced, the source file swapped, or the panel unmounted.
  const [resultUrl, setResultUrl] = useState("");
  useEffect(() => {
    if (!result) {
      setResultUrl("");
      return;
    }
    const url = URL.createObjectURL(result.blob);
    setResultUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [result]);

  const meta = FORMAT_META[format];
  const lossy = meta.lossy;

  async function run() {
    setBusy(true);
    setError(null);
    try {
      setResult(await compressFile(file, { format, quality }));
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
      if (path) onSaved(path);
    } catch (e) {
      setError(String(e));
    }
  }

  const saving = result ? pct(file.size, result.size) : 0;

  return (
    <div>
      <div className="t-controls compress-controls">
        <div className="t-field">
          <span className="t-label">{s.compress.format}</span>
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
          <div className="t-field cc-quality">
            <span className="t-label">{s.compress.quality} · {quality}</span>
            <div className="cc-range">
              <input
                className="t-range"
                type="range"
                min={1}
                max={100}
                value={quality}
                style={{ ["--fill"]: `${quality}%` } as CSSProperties}
                onChange={(e) => setQuality(Number(e.target.value))}
              />
            </div>
          </div>
        )}

        <span className="head-spacer" style={{ flex: 1 }} />

        <button className="b-btn b-btn--solid" onClick={run} disabled={busy}>
          {busy ? s.compress.running : s.compress.run}
        </button>
      </div>

      {error && <div className="b-error">{error}</div>}

      {result && resultUrl ? (
        <Compare
          beforeUrl={originalUrl}
          afterUrl={resultUrl}
          beforeLabel={s.compress.original}
          afterLabel={meta.label.split(" ")[0]}
          beforeMeta={formatBytes(file.size)}
          afterMeta={`${formatBytes(result.size)} · −${saving < 0 ? 0 : saving}% · ${result.ms}ms`}
          matte={matte}
          onMatte={setMatte}
        />
      ) : (
        <SingleView
          url={originalUrl}
          alt="original"
          label={s.compress.original}
          meta={formatBytes(file.size)}
          matte={matte}
          onMatte={setMatte}
        />
      )}

      {result && (
        <div className="t-actions">
          <button className="b-btn b-btn--yellow" onClick={onSave}>
            {s.compress.save}
          </button>
          <PipeButtons
            current="compress"
            onSend={(tool) => {
              if (!result) return;
              const base = file.name.replace(/\.[^.]+$/, "");
              onSendTo(
                new File([result.bytes], `${base}-min.${meta.ext}`, {
                  type: meta.mime,
                }),
                tool,
              );
            }}
          />
        </div>
      )}
    </div>
  );
}

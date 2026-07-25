import { useEffect, useState } from "react";
import { listModels, type ModelStatus } from "../lib/models";
import { removeBackground } from "../lib/ai";
import { saveBytes } from "../lib/save";
import { ModelManager } from "./ModelManager";
import { Compare } from "./Compare";
import { PipeButtons } from "./PipeButtons";
import type { Tool } from "./HomeScreen";
import { formatBytes } from "../lib/format";
import { hasTauri } from "../lib/tauri";
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

export function BackgroundPanel({ file, srcDir, onSendTo, onSaved }: Props) {
  const s = useStrings();
  const [models, setModels] = useState<ModelStatus[]>([]);
  const [selected, setSelected] = useState<string>("");
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
    const bg = all.filter((m) => m.category === "background");
    setModels(bg);
    const dl = bg.filter((m) => m.downloaded);
    if (dl.length && !dl.find((m) => m.id === selected)) {
      setSelected(dl[0].id);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const downloaded = models.filter((m) => m.downloaded);

  if (!hasTauri()) {
    return (
      <div className="t-info">
        <div className="t-info-icon">🖥</div>
        {s.background.browser}
      </div>
    );
  }

  async function run() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const blob = await removeBackground(file, selected);
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
    const path = await saveBytes(resultBytes, `${base}-nobg.png`, "png", srcDir);
    if (path) {
      setSaved(path);
      onSaved(path);
    }
  }

  if (downloaded.length === 0) {
    return (
      <div>
        <div className="onboard">
          <div className="onboard-title">{s.background.onboardTitle}</div>
          {s.background.onboard}
        </div>
        <ModelManager filter="background" onChanged={refresh} />
      </div>
    );
  }

  return (
    <div>
      <div className="t-controls">
        <div className="t-field">
          <span className="t-label">{s.background.model}</span>
          <select
            className="t-select"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {downloaded.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <button className="b-btn b-btn--solid" onClick={run} disabled={busy}>
          {busy ? s.background.running : s.background.run}
        </button>
      </div>

      {error && <div className="b-error">{error}</div>}

      {resultUrl ? (
        <Compare
          beforeUrl={originalUrl}
          afterUrl={resultUrl}
          beforeLabel={s.background.original}
          afterLabel={s.background.nobg}
          afterMeta={resultBytes ? formatBytes(resultBytes.length) : undefined}
          transparent
        />
      ) : (
        <div className="single-view">
          <div className="cmp-img-wrap">
            {originalUrl && <img src={originalUrl} alt="original" />}
          </div>
          <div className="cmp-cap" style={{ borderTop: "3px solid var(--line)" }}>
            <span>{s.background.original}</span>
          </div>
        </div>
      )}

      {resultUrl && (
        <div className="t-actions">
          <button className="b-btn b-btn--yellow" onClick={onSave}>
            {s.background.save}
          </button>
          {saved && <span className="t-saved">{s.background.saved} {saved}</span>}
          <PipeButtons
            current="background"
            onSend={(tool) => {
              if (!resultBytes) return;
              const base = file.name.replace(/\.[^.]+$/, "");
              onSendTo(
                new File([resultBytes as BlobPart], `${base}-nobg.png`, {
                  type: "image/png",
                }),
                tool,
              );
            }}
          />
        </div>
      )}

      <details className="m-details">
        <summary>{s.background.details}</summary>
        <ModelManager filter="background" onChanged={refresh} />
      </details>
    </div>
  );
}

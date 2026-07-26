import { useEffect, useState, type CSSProperties } from "react";
import { listModels, type ModelStatus } from "../lib/models";
import { removeBackground } from "../lib/ai";
import {
  applyMatte,
  DEFAULT_EDGE,
  edgeIsIdentity,
  type EdgeSettings,
} from "../lib/matte";
import { saveBytes } from "../lib/save";
import { ModelManager } from "./ModelManager";
import { Compare } from "./Compare";
import { SingleView } from "./SingleView";
import { type Matte } from "../lib/matteBg";
import { HelpTip } from "./HelpTip";
import { PipeButtons } from "./PipeButtons";
import type { Tool } from "./HomeScreen";
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
  // The pristine model output; `resultBytes` is it with edge tweaks applied.
  const [rawBytes, setRawBytes] = useState<Uint8Array | null>(null);
  const [edge, setEdge] = useState<EdgeSettings>(DEFAULT_EDGE);
  const [adjusting, setAdjusting] = useState(false);
  const [resultBytes, setResultBytes] = useState<Uint8Array | null>(null);
  const [resultUrl, setResultUrl] = useState<string>("");
  // Cut-outs read best against the checkerboard by default.
  const [matte, setMatte] = useState<Matte>("checker");

  const [originalUrl, setOriginalUrl] = useState<string>("");
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setOriginalUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    setRawBytes(null);
    setResultBytes(null);
    setEdge(DEFAULT_EDGE);
  }, [file]);

  // Re-derive the shown/saved bytes from the raw cutout whenever the edge
  // controls change. Debounced so dragging a slider stays smooth.
  useEffect(() => {
    if (!rawBytes) {
      setResultBytes(null);
      return;
    }
    if (edgeIsIdentity(edge)) {
      setResultBytes(rawBytes);
      setAdjusting(false);
      return;
    }
    let cancelled = false;
    setAdjusting(true);
    const t = setTimeout(() => {
      applyMatte(file, rawBytes, edge)
        .then((out) => !cancelled && setResultBytes(out))
        .catch(() => !cancelled && setResultBytes(rawBytes))
        .finally(() => !cancelled && setAdjusting(false));
    }, 140);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [rawBytes, edge, file]);
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
    try {
      const blob = await removeBackground(file, selected);
      const buf = new Uint8Array(await blob.arrayBuffer());
      setRawBytes(buf);
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
    if (path) onSaved(path);
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
          transparent
          matte={matte}
          onMatte={setMatte}
        />
      ) : (
        <SingleView
          url={originalUrl}
          alt="original"
          label={s.background.original}
          matte={matte}
          onMatte={setMatte}
        />
      )}

      {rawBytes && (
        <div className="t-controls bg-edge">
          <div className="bg-edge-head">
            <span className="t-label">{s.background.edge}</span>
            {adjusting && <span className="bg-edge-busy">{s.background.adjusting}</span>}
            {!edgeIsIdentity(edge) && (
              <button className="b-link" onClick={() => setEdge(DEFAULT_EDGE)}>
                {s.background.edgeReset}
              </button>
            )}
          </div>
          <div className="t-field">
            <span className="t-label">
              <HelpTip tip={s.background.hardnessTip} />
              {s.background.hardness} · {edge.hardness}
            </span>
            <input
              className="t-range"
              type="range"
              min={0}
              max={100}
              value={edge.hardness}
              style={{ ["--fill"]: `${edge.hardness}%` } as CSSProperties}
              onChange={(e) => setEdge({ ...edge, hardness: Number(e.target.value) })}
            />
          </div>
          <div className="t-field">
            <span className="t-label">
              <HelpTip tip={s.background.growTip} />
              {s.background.grow} · {edge.grow > 0 ? `+${edge.grow}` : edge.grow}
            </span>
            <input
              className="t-range"
              type="range"
              min={-12}
              max={12}
              value={edge.grow}
              style={{ ["--fill"]: `${((edge.grow + 12) / 24) * 100}%` } as CSSProperties}
              onChange={(e) => setEdge({ ...edge, grow: Number(e.target.value) })}
            />
          </div>
          <div className="t-field">
            <span className="t-label">
              <HelpTip tip={s.background.featherTip} />
              {s.background.feather} · {edge.feather}
            </span>
            <input
              className="t-range"
              type="range"
              min={0}
              max={12}
              value={edge.feather}
              style={{ ["--fill"]: `${(edge.feather / 12) * 100}%` } as CSSProperties}
              onChange={(e) => setEdge({ ...edge, feather: Number(e.target.value) })}
            />
          </div>
          <p className="bg-edge-note">{s.background.edgeNote}</p>
        </div>
      )}

      {resultUrl && (
        <div className="t-actions">
          <button className="b-btn b-btn--yellow" onClick={onSave}>
            {s.background.save}
          </button>
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

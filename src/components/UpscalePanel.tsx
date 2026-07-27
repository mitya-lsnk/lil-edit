import { useEffect, useMemo, useState } from "react";
import { listModels, type ModelStatus } from "../lib/models";
import { ENGINES, DENOISE, FOUR } from "../lib/engines";
import { upscaleImage } from "../lib/ai";
import { saveBytes } from "../lib/save";
import { ModelManager } from "./ModelManager";
import { HelpTip } from "./HelpTip";
import { Compare } from "./Compare";
import { SingleView } from "./SingleView";
import { type Matte } from "../lib/matteBg";
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

export function UpscalePanel({ file, srcDir, onSendTo, onSaved }: Props) {
  const s = useStrings();
  const [models, setModels] = useState<ModelStatus[]>([]);
  const [engineId, setEngineId] = useState<string | null>(null);
  const [modelValue, setModelValue] = useState<string | null>(null);
  const [scale, setScale] = useState(4);
  const [denoise, setDenoise] = useState(1);
  const [matte, setMatte] = useState<Matte>("theme");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultBytes, setResultBytes] = useState<Uint8Array | null>(null);
  const [resultUrl, setResultUrl] = useState<string>("");
  const [resultDims, setResultDims] = useState<{ w: number; h: number } | null>(
    null,
  );

  const [originalUrl, setOriginalUrl] = useState<string>("");
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setOriginalUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    setResultBytes(null);
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
  // Read the final pixel dimensions off the decoded result for the meta readout.
  useEffect(() => {
    if (!resultUrl) {
      setResultDims(null);
      return;
    }
    // Guard the decode: a second run before this one loads would otherwise let
    // the stale image win the race and report the previous result's size.
    let alive = true;
    const img = new Image();
    img.onload = () => {
      if (alive) setResultDims({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = resultUrl;
    return () => {
      alive = false;
      img.onload = null;
    };
  }, [resultUrl]);

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
  // Denoising is the entire point of the scale-1 pass, so "off" would run the
  // engine to produce a copy of the input. Drop the option and floor the level.
  const denoiseLevels = effScale === 1 ? DENOISE.filter((d) => d >= 0) : DENOISE;
  const effDenoise = effScale === 1 && denoise < 0 ? 1 : denoise;

  if (!hasTauri()) {
    return (
      <div className="t-info">
        <div className="t-info-icon">🖥</div>
        {s.upscale.browser}
      </div>
    );
  }

  async function run() {
    if (!engine || !model) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await upscaleImage(file, {
        engine: engine.id,
        scale: effScale,
        modelName: model.value,
        denoise: effDenoise,
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
    if (path) onSaved(path);
  }

  if (!engine) {
    return (
      <div>
        <div className="onboard">
          <div className="onboard-title">{s.upscale.onboardTitle}</div>
          {s.upscale.onboard}
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
            <span className="t-label">{s.upscale.engine}</span>
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
          <span className="t-label">{s.upscale.model}</span>
          <select
            className="t-select"
            value={model?.value}
            onChange={(e) => setModelValue(e.target.value)}
          >
            {engine.models.map((m) => (
              <option key={m.value} value={m.value}>
                {s.upscale.modelLabels[m.value] ?? m.value}
              </option>
            ))}
          </select>
        </div>
        <div className="t-field">
          <span className="t-label">
            {/* ×1 is a denoise-only pass, which nothing about a list of scale
                buttons makes obvious. Only cunet offers it. */}
            {scales.includes(1) && <HelpTip tip={s.upscale.scaleOneTip} />}
            {s.upscale.scale}
          </span>
          <div className="t-seg">
            {scales.map((sc) => (
              <button
                key={sc}
                className={effScale === sc ? "active" : ""}
                onClick={() => setScale(sc)}
              >
                {/* Scale 1 is a denoise-only pass, so it says so rather than
                    sitting in the row as a "×1" that looks like a no-op. */}
                {sc === 1 ? s.upscale.denoiseSeg : `×${sc}`}
              </button>
            ))}
          </div>
        </div>
        {engine.denoise && (
          <div className="t-field">
            <span className="t-label">{s.upscale.denoise}</span>
            <div className="t-seg">
              {denoiseLevels.map((d) => (
                <button
                  key={d}
                  className={effDenoise === d ? "active" : ""}
                  onClick={() => setDenoise(d)}
                >
                  {d === -1 ? s.upscale.denoiseNone : String(d)}
                </button>
              ))}
            </div>
          </div>
        )}
        <button className="b-btn b-btn--solid" onClick={run} disabled={busy}>
          {busy ? s.upscale.running : s.upscale.run}
        </button>
      </div>

      {effScale === 1 && <p className="t-muted">{s.upscale.denoiseOnly}</p>}
      {busy && <p className="t-muted">{s.upscale.busyNote}</p>}
      {error && <div className="b-error">{error}</div>}

      {resultUrl ? (
        <Compare
          beforeUrl={originalUrl}
          afterUrl={resultUrl}
          beforeLabel={s.upscale.original}
          afterLabel={`×${effScale}`}
          matte={matte}
          onMatte={setMatte}
          afterMeta={
            resultBytes ? (
              <span className="cmp-res">
                {resultDims && (
                  <>
                    {resultDims.w}×{resultDims.h}
                    <br />
                  </>
                )}
                {formatBytes(resultBytes.length)}
              </span>
            ) : undefined
          }
        />
      ) : (
        <SingleView
          url={originalUrl}
          alt="original"
          label={s.upscale.original}
          matte={matte}
          onMatte={setMatte}
        />
      )}

      {resultUrl && (
        <div className="t-actions">
          <button className="b-btn b-btn--yellow" onClick={onSave}>
            {s.upscale.save}
          </button>
          <PipeButtons
            current="upscale"
            onSend={(tool) => {
              if (!resultBytes) return;
              const base = file.name.replace(/\.[^.]+$/, "");
              onSendTo(
                new File([resultBytes as BlobPart], `${base}-x${effScale}.png`, {
                  type: "image/png",
                }),
                tool,
              );
            }}
          />
        </div>
      )}

      <details className="m-details">
        <summary>{s.upscale.details}</summary>
        <ModelManager filter="upscale" onChanged={refresh} />
      </details>
    </div>
  );
}

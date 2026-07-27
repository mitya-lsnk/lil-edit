import { useEffect, useRef, useState, type CSSProperties } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { hasTauri } from "../lib/tauri";
import { useStrings } from "../lib/i18n";
import { listModels, type ModelStatus } from "../lib/models";
import { ENGINES, DENOISE } from "../lib/engines";
import { FORMAT_META, type OutputFormat } from "../lib/compress";
import {
  clearPaths,
  listFolderImages,
  loadPaths,
  loadSettings,
  runBatch,
  savePaths,
  saveSettings,
  type BatchError,
  type BatchOpId,
  type BatchPaths,
  type BatchProgress,
  type BatchSettings,
} from "../lib/batch";

const FORMATS: OutputFormat[] = ["mozjpeg", "webp", "avif", "oxipng"];
const OPS: BatchOpId[] = ["upscale", "background", "compress", "resize"];

export function BatchPanel() {
  const s = useStrings();
  const [paths, setPathsState] = useState<BatchPaths>(loadPaths);
  const [settings, setSettingsState] = useState<BatchSettings>(loadSettings);
  const [files, setFiles] = useState<string[]>([]);
  const [models, setModels] = useState<ModelStatus[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [result, setResult] = useState<{ ok: number; errors: BatchError[] } | null>(null);
  const cancelRef = useRef(false);

  function patchPaths(p: Partial<BatchPaths>) {
    setPathsState((prev) => {
      const next = { ...prev, ...p };
      // Only persist when the user asked us to remember.
      if (next.remember) savePaths(next);
      else clearPaths();
      return next;
    });
  }
  function patch(p: Partial<BatchSettings>) {
    setSettingsState((prev) => {
      const next = { ...prev, ...p };
      saveSettings(next);
      return next;
    });
  }

  async function refreshFiles(dir: string) {
    if (!dir) {
      setFiles([]);
      return;
    }
    try {
      setFiles(await listFolderImages(dir));
    } catch {
      setFiles([]);
    }
  }

  // On mount: load installed models and re-list a remembered source folder.
  useEffect(() => {
    if (!hasTauri()) return;
    listModels()
      .then(setModels)
      .catch(() => setModels([]));
    if (paths.source) refreshFiles(paths.source);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!hasTauri()) {
    return (
      <div className="t-info">
        <div className="t-info-icon">🖥</div>
        {s.batch.browser}
      </div>
    );
  }

  async function pickSource() {
    const d = await open({ directory: true, multiple: false });
    if (typeof d !== "string") return;
    // Convenience only: fill an empty destination with the source. A dest the
    // user already chose is left untouched.
    patchPaths(paths.dest ? { source: d } : { source: d, dest: d });
    refreshFiles(d);
  }
  async function pickDest() {
    const d = await open({ directory: true, multiple: false });
    if (typeof d === "string") patchPaths({ dest: d });
  }
  function onRemember(checked: boolean) {
    patchPaths({ remember: checked });
  }

  // Upscale engine/model resolution — same rules as the single-image panel.
  const engines = ENGINES.filter((e) =>
    models.some((m) => m.id === e.id && m.downloaded),
  );
  const engine = engines.find((e) => e.id === settings.engineId) ?? engines[0];
  const modelOpts = engine?.models ?? [];
  const model =
    modelOpts.find((m) => m.value === settings.modelValue) ?? modelOpts[0];
  const scales = model?.scales ?? [2, 3, 4];
  const bgModels = models.filter((m) => m.category === "background" && m.downloaded);

  // Is the current operation actually runnable?
  const opReady =
    settings.op === "compress" ||
    settings.op === "resize" ||
    (settings.op === "upscale" && !!engine && !!model) ||
    (settings.op === "background" && bgModels.length > 0);

  const canRun =
    !running && files.length > 0 && !!paths.source && !!paths.dest && opReady;

  async function start() {
    if (!canRun) return;
    setResult(null);
    setRunning(true);
    cancelRef.current = false;
    // Lock in the resolved upscale selection so it matches the dropdowns.
    const eff: BatchSettings = {
      ...settings,
      engineId: engine?.id ?? settings.engineId,
      modelValue: model?.value ?? settings.modelValue,
      scale: scales.includes(settings.scale) ? settings.scale : scales[scales.length - 1],
      bgModelId:
        settings.op === "background" && !bgModels.some((m) => m.id === settings.bgModelId)
          ? bgModels[0].id
          : settings.bgModelId,
    };
    const r = await runBatch(files, paths.dest, eff, setProgress, () => cancelRef.current);
    setResult(r);
    setRunning(false);
    setProgress(null);
  }

  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="batch">
      {/* -------- source / destination -------- */}
      <div className="b-panel batch-io">
        <div className="batch-row">
          <span className="batch-lbl">{s.batch.source}</span>
          <input
            className="batch-path"
            value={paths.source}
            placeholder={s.batch.sourcePh}
            onChange={(e) => {
              const v = e.target.value;
              patchPaths(paths.dest ? { source: v } : { source: v, dest: v });
            }}
            onBlur={() => refreshFiles(paths.source)}
          />
          <button className="b-btn" onClick={pickSource}>{s.batch.pickFolder}</button>
        </div>
        <div className="batch-row">
          <span className="batch-lbl">{s.batch.dest}</span>
          <input
            className="batch-path"
            value={paths.dest}
            placeholder={s.batch.destPh}
            onChange={(e) => patchPaths({ dest: e.target.value })}
          />
          <button className="b-btn" onClick={pickDest}>
            {s.batch.pickFolder}
          </button>
          <label className="t-check edit-lock batch-remember">
            <input
              type="checkbox"
              checked={paths.remember}
              onChange={(e) => onRemember(e.target.checked)}
            />
            {s.batch.remember}
          </label>
        </div>
        <div className="batch-count">
          {files.length > 0 ? s.batch.found(files.length) : s.batch.empty}
        </div>
      </div>

      {/* -------- operation + its settings -------- */}
      <div className="t-controls batch-op">
        <div className="t-field">
          <span className="t-label">{s.batch.operation}</span>
          <div className="t-seg">
            {OPS.map((op) => (
              <button
                key={op}
                className={settings.op === op ? "active" : ""}
                onClick={() => patch({ op })}
              >
                {op === "resize" ? s.edit.resize : s.tools[op]}
              </button>
            ))}
          </div>
        </div>

        {settings.op === "compress" && (
          <>
            <div className="t-field">
              <span className="t-label">{s.compress.format}</span>
              <div className="t-seg">
                {FORMATS.map((f) => (
                  <button
                    key={f}
                    className={settings.format === f ? "active" : ""}
                    onClick={() => patch({ format: f })}
                  >
                    {FORMAT_META[f].label.split(" ")[0]}
                  </button>
                ))}
              </div>
            </div>
            {FORMAT_META[settings.format].lossy && (
              <div className="t-field">
                <span className="t-label">{s.compress.quality} · {settings.quality}</span>
                <input className="t-range" type="range" min={1} max={100}
                  value={settings.quality}
                  style={{ ["--fill"]: `${settings.quality}%` } as CSSProperties}
                  onChange={(e) => patch({ quality: Number(e.target.value) })} />
              </div>
            )}
          </>
        )}

        {settings.op === "resize" && (
          <div className="edit-num">
            <span className="t-label">{s.edit.percent} · {settings.percent}%</span>
            <input className="t-num" type="number" min={1} max={1000} value={settings.percent}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => patch({ percent: Number(e.target.value) })} />
          </div>
        )}

        {settings.op === "background" && (
          <div className="t-field">
            <span className="t-label">{s.background.model}</span>
            {bgModels.length ? (
              <select className="t-select" value={settings.bgModelId}
                onChange={(e) => patch({ bgModelId: e.target.value })}>
                {bgModels.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            ) : (
              <span className="batch-note">{s.batch.needModel}</span>
            )}
          </div>
        )}

        {settings.op === "upscale" && (
          engine && model ? (
            <>
              <div className="t-field">
                <span className="t-label">{s.upscale.engine}</span>
                <select className="t-select" value={engine.id}
                  onChange={(e) => patch({ engineId: e.target.value })}>
                  {engines.map((en) => (
                    <option key={en.id} value={en.id}>{en.short}</option>
                  ))}
                </select>
              </div>
              <div className="t-field">
                <span className="t-label">{s.upscale.model}</span>
                <select className="t-select" value={model.value}
                  onChange={(e) => patch({ modelValue: e.target.value })}>
                  {modelOpts.map((m) => (
                    <option key={m.value} value={m.value}>
                      {s.upscale.modelLabels[m.value] ?? m.value}
                    </option>
                  ))}
                </select>
              </div>
              {/* A model with one possible factor gets no chooser — a lone ×4
                  button reads as a control that does nothing. `start()` clamps
                  the stored scale to what the model can do. */}
              {scales.length > 1 && (
                <div className="t-field">
                  <span className="t-label">{s.upscale.scale}</span>
                  <div className="t-seg">
                    {scales.map((sc) => (
                      <button key={sc}
                        className={(scales.includes(settings.scale) ? settings.scale : scales[scales.length - 1]) === sc ? "active" : ""}
                        onClick={() => patch({ scale: sc })}>×{sc}</button>
                    ))}
                  </div>
                </div>
              )}
              {engine.denoise && (
                <div className="t-field">
                  <span className="t-label">{s.upscale.denoise}</span>
                  <div className="t-seg">
                    {DENOISE.map((d) => (
                      <button key={d}
                        className={settings.denoise === d ? "active" : ""}
                        onClick={() => patch({ denoise: d })}>
                        {d < 0 ? s.upscale.denoiseNone : d}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <span className="batch-note">{s.batch.needEngine}</span>
          )
        )}
      </div>

      {/* -------- run -------- */}
      <div className="batch-run">
        {running ? (
          <>
            <div className="batch-prog">
              <div className="batch-prog-bar" style={{ width: `${pct}%` }} />
            </div>
            <span className="batch-prog-lbl">
              {progress ? `${progress.done}/${progress.total}` : ""} {progress?.current}
            </span>
            <button className="b-btn" onClick={() => (cancelRef.current = true)}>
              {s.batch.cancel}
            </button>
          </>
        ) : (
          <button className="b-btn b-btn--solid batch-go" disabled={!canRun} onClick={start}>
            {s.batch.process}
          </button>
        )}
      </div>

      {result && !running && (
        <div className="batch-result">
          {s.batch.done(result.ok, files.length)}
          {result.errors.length > 0 && (
            <ul className="batch-errs">
              {result.errors.slice(0, 6).map((er, i) => (
                <li key={i}>{er.name}: {er.error}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  deleteModel,
  downloadModel,
  listModels,
  modelsDirPath,
  onModelProgress,
  type ModelStatus,
} from "../lib/models";
import { formatBytes } from "../lib/format";

interface ProgressState {
  [id: string]: { downloaded: number; total: number; phase: string };
}

interface Props {
  filter?: "background" | "upscale";
  onChanged?: () => void;
}

export function ModelManager({ filter, onChanged }: Props) {
  const [models, setModels] = useState<ModelStatus[]>([]);
  const [progress, setProgress] = useState<ProgressState>({});
  const [dir, setDir] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setModels(await listModels());
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    refresh();
    modelsDirPath().then(setDir).catch(() => {});
    const un = onModelProgress((p) => {
      setProgress((prev) => ({
        ...prev,
        [p.id]: { downloaded: p.downloaded, total: p.total, phase: p.phase },
      }));
      if (p.phase === "done") {
        setTimeout(() => {
          setProgress((prev) => {
            const next = { ...prev };
            delete next[p.id];
            return next;
          });
          refresh();
          onChanged?.();
        }, 400);
      }
    });
    return () => {
      un.then((f) => f());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDownload(id: string) {
    setError(null);
    setProgress((prev) => ({
      ...prev,
      [id]: { downloaded: 0, total: 1, phase: "download" },
    }));
    try {
      await downloadModel(id);
    } catch (e) {
      setError(String(e));
      setProgress((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteModel(id);
      await refresh();
      onChanged?.();
    } catch (e) {
      setError(String(e));
    }
  }

  const shown = filter ? models.filter((m) => m.category === filter) : models;

  return (
    <div className="m-list">
      {error && <div className="b-error">{error}</div>}
      {shown.map((m) => {
        const p = progress[m.id];
        const downloading = !!p;
        const frac = p && p.total > 0 ? p.downloaded / p.total : 0;
        return (
          <div className="m-card" key={m.id}>
            <div className="m-head">
              <div className="m-title">
                <span
                  className={`m-radio ${m.downloaded ? "on" : ""}`}
                  aria-hidden
                />
                <span className="m-name">{m.name}</span>
                {m.tag && <span className="m-badge tag">{m.tag}</span>}
                <span className="m-badge">{m.size}</span>
                {m.downloaded && <span className="m-badge ok">УСТАНОВЛЕНО</span>}
              </div>
              <div className="m-actions">
                <button className="b-link" onClick={() => openUrl(m.homepage)}>
                  источник ↗
                </button>
                {m.downloaded ? (
                  <button className="b-btn" onClick={() => handleDelete(m.id)}>
                    Удалить
                  </button>
                ) : (
                  <button
                    className="b-btn b-btn--solid"
                    disabled={downloading}
                    onClick={() => handleDownload(m.id)}
                  >
                    {downloading ? "…" : "Скачать ↓"}
                  </button>
                )}
              </div>
            </div>
            <div className="m-desc">{m.description}</div>
            <div className="m-license">{m.license}</div>
            {downloading && (
              <div className="m-progress">
                <div
                  className="m-progress-bar"
                  style={{ width: `${Math.round(frac * 100)}%` }}
                />
                <span className="m-progress-label">
                  {p.phase === "extract"
                    ? "распаковка…"
                    : p.phase === "done"
                      ? "готово"
                      : `${formatBytes(p.downloaded)} / ${formatBytes(p.total)}`}
                </span>
              </div>
            )}
          </div>
        );
      })}
      {dir && (
        <div className="m-dir">
          Модели: <span>{dir}</span>
        </div>
      )}
    </div>
  );
}

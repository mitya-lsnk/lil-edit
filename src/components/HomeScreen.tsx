import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { onDragHover, pickImage, type Picked } from "../lib/intake";
import { hasTauri } from "../lib/tauri";
import { useStrings } from "../lib/i18n";

export type Tool = "compress" | "upscale" | "background" | "edit";

interface Props {
  file: File | null;
  onFile: (p: Picked) => void;
  onPick: (tool: Tool) => void;
  /** Open the batch ("несколько") screen. */
  onBatch: () => void;
  /** Resume the tool the user was in (undefined when there's nothing to resume). */
  onContinue?: () => void;
}

const CARDS: {
  tool: Tool;
  cls: string;
  num: string;
  name: string;
  checker?: boolean;
}[] = [
  // Order requested by users: Upscale → Remove BG → Edit → Compress. Each tool
  // keeps its own colour class (cls), so only the running number reflects order.
  { tool: "upscale", cls: "c2", num: "01", name: "UPSCALE" },
  { tool: "background", cls: "c3", num: "02", name: "REMOVE BG", checker: true },
  { tool: "edit", cls: "c4", num: "03", name: "EDIT" },
  { tool: "compress", cls: "c1", num: "04", name: "COMPRESS" },
];

export function HomeBody({ file, onFile, onPick, onBatch, onContinue }: Props) {
  const s = useStrings();
  const [over, setOver] = useState(false);
  const [thumb, setThumb] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // StrictMode-safe object URL lifecycle: create + revoke in one effect.
  useEffect(() => {
    if (!file) {
      setThumb(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setThumb(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Native drag-drop swallows dragover, so the highlight comes from Tauri.
  useEffect(() => onDragHover(setOver), []);

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const img = Array.from(files).find((f) => f.type.startsWith("image/"));
    if (img) onFile({ file: img, path: null });
  }

  // In the app go through the native dialog — it's the only picker that tells us
  // where the file lives, which is what Save needs to default next to it.
  const pick = async () => {
    if (!hasTauri()) {
      inputRef.current?.click();
      return;
    }
    const picked = await pickImage(s.intake.imagesFilter);
    if (picked) onFile(picked);
  };

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      hidden
      onChange={(e) => handleFiles(e.target.files)}
    />
  );

  // ---- Start state: ONLY a big drag-and-drop ----
  if (!file) {
    return (
      <div className="home-start">
        <div
          className={`home-drop big ${over ? "over" : ""}`}
          onClick={pick}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          role="button"
          tabIndex={0}
        >
          {fileInput}
          <div className="plus" />
          <div className="dz-title">{s.app.dropTitle}</div>
          <div className="dz-sub">{s.home.dropSubClick}</div>
        </div>
        <button className="b-btn home-batch" onClick={onBatch}>
          <Icon name="grid" size={14} /> {s.home.batchEntry}
        </button>
      </div>
    );
  }

  // ---- Loaded state: compact file strip + tool cards ----
  return (
    <>
      {fileInput}
      <div className="loaded-strip">
        {thumb && <img className="ls-thumb" src={thumb} alt="" />}
        <div className="ls-info">
          <div className="ls-label">{s.home.loaded}</div>
          <div className="ls-name">{file.name}</div>
        </div>
        {onContinue && (
          <button className="b-btn b-btn--solid" onClick={onContinue}>
            {s.home.continue} →
          </button>
        )}
        <button className="b-btn" onClick={pick}>
          {s.home.replace}
        </button>
        <button className="b-btn" onClick={onBatch}>
          <Icon name="grid" size={14} /> {s.batch.tab}
        </button>
      </div>

      <div className="tool-head">{s.home.toolHead}</div>
      <div className="tool-grid">
        {CARDS.map((c) => (
          <button
            key={c.tool}
            className={`tool-card ${c.cls}`}
            onClick={() => onPick(c.tool)}
          >
            <span className="num">{c.num}</span>
            <span className="tname">{c.name}</span>
            <span className="desc">{s.home.cards[c.tool]}</span>
            {c.checker && (
              <span className="checker-chip b-checker">
                <span className="dot" />
              </span>
            )}
            <span className="run">RUN →</span>
          </button>
        ))}
      </div>
    </>
  );
}

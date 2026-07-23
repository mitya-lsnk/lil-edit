import { useEffect, useRef, useState } from "react";

export type Tool = "compress" | "upscale" | "background";

interface Props {
  file: File | null;
  onFile: (f: File) => void;
  onPick: (tool: Tool) => void;
}

const CARDS: {
  tool: Tool;
  cls: string;
  num: string;
  name: string;
  desc: string;
  checker?: boolean;
}[] = [
  {
    tool: "compress",
    cls: "c1",
    num: "01",
    name: "COMPRESS",
    desc: "Сжать файл без потери деталей.",
  },
  {
    tool: "upscale",
    cls: "c2",
    num: "02",
    name: "UPSCALE",
    desc: "Увеличить и повысить резкость.",
  },
  {
    tool: "background",
    cls: "c3",
    num: "03",
    name: "REMOVE BG",
    desc: "Вырезать объект, убрать фон.",
    checker: true,
  },
];

export function HomeBody({ file, onFile, onPick }: Props) {
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

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const img = Array.from(files).find((f) => f.type.startsWith("image/"));
    if (img) onFile(img);
  }

  const pick = () => inputRef.current?.click();

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
        <div className="dz-title">Перетащите изображение сюда</div>
        <div className="dz-sub">
          бросьте файл в любое место окна или <u>нажмите, чтобы выбрать</u>
        </div>
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
          <div className="ls-label">Изображение загружено</div>
          <div className="ls-name">{file.name}</div>
        </div>
        <button className="b-btn" onClick={pick}>
          Заменить
        </button>
      </div>

      <div className="tool-head">Что сделаем?</div>
      <div className="tool-grid">
        {CARDS.map((c) => (
          <button
            key={c.tool}
            className={`tool-card ${c.cls}`}
            onClick={() => onPick(c.tool)}
          >
            <span className="num">{c.num}</span>
            <span className="tname">{c.name}</span>
            <span className="desc">{c.desc}</span>
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

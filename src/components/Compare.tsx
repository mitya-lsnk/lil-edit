import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Props {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
  beforeMeta?: string;
  afterMeta?: string;
  /** the "after" image has transparency (a cut-out) — enables the matte picker */
  transparent?: boolean;
}

type Matte = "checker" | "white" | "black";
const MATTE_BG: Record<Exclude<Matte, "checker">, string> = {
  white: "#ffffff",
  black: "#111111",
};

/**
 * hold  — result on screen, press and hold to peek at the original (default)
 * split — draggable divider
 * side  — the two images next to each other
 */
type Mode = "hold" | "split" | "side";

const LENS = 150; // px diameter
const ZOOM = 3;

export function Compare({
  beforeUrl,
  afterUrl,
  beforeLabel = "ДО",
  afterLabel = "ПОСЛЕ",
  beforeMeta,
  afterMeta,
  transparent,
}: Props) {
  const [mode, setMode] = useState<Mode>("hold");
  const [pct, setPct] = useState(50);
  const [full, setFull] = useState(false);
  // Backdrop shown behind a transparent cut-out, so leftover fringes are visible
  // against every kind of background.
  const [matte, setMatte] = useState<Matte>("checker");
  // The loupe follows the cursor by default; the toggle is just an escape hatch.
  const [loupe, setLoupe] = useState(true);
  const [holding, setHolding] = useState(false);
  const [lens, setLens] = useState<{
    show: boolean;
    x: number;
    y: number;
    bg: string;
    size: string;
    src: string;
  }>({ show: false, x: 0, y: 0, bg: "0 0", size: "", src: "" });

  const splitRef = useRef<HTMLDivElement>(null);
  const afterImgRef = useRef<HTMLImageElement>(null);
  const beforeImgRef = useRef<HTMLImageElement>(null);
  const holdImgRef = useRef<HTMLImageElement>(null);
  // Last cursor position over a stage, so we can recompute the lens when the
  // image swaps (hold mode) without waiting for the next mousemove.
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  // Safety net for hold mode: if the button comes up somewhere we don't get an
  // event for (outside the window, pointer capture lost), release anyway —
  // otherwise the view stays stuck on the original with no way back.
  useEffect(() => {
    if (!holding) return;
    const release = () => setHolding(false);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      window.removeEventListener("blur", release);
    };
  }, [holding]);

  // When hold toggles, re-magnify the image that is *now* shown (before⇄after)
  // at the cursor's last position — otherwise the lens keeps the stale picture.
  useEffect(() => {
    if (mode !== "hold" || !lens.show) return;
    const p = lastPos.current;
    if (!p) return;
    onLoupeMove(p.x, p.y, holdImgRef.current, holding ? beforeUrl : afterUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holding]);

  function moveTo(clientX: number) {
    const el = splitRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let p = ((clientX - r.left) / r.width) * 100;
    p = Math.max(0, Math.min(100, p));
    setPct(p);
  }

  /**
   * Magnifier. `img` is the element actually under the cursor and `src` the
   * image it displays, so the lens shows whichever of the two the user is
   * pointing at — the before side of the slider magnifies the before image.
   * Geometry is object-fit: contain aware.
   */
  function onLoupeMove(
    clientX: number,
    clientY: number,
    img: HTMLImageElement | null,
    src: string,
  ) {
    if (!loupe || !img) return;
    lastPos.current = { x: clientX, y: clientY };
    const box = img.getBoundingClientRect();
    const natW = img.naturalWidth || box.width;
    const natH = img.naturalHeight || box.height;
    const ar = natW / natH;
    let dw: number, dh: number;
    if (box.width / box.height > ar) {
      dh = box.height;
      dw = box.height * ar;
    } else {
      dw = box.width;
      dh = box.width / ar;
    }
    const offX = (box.width - dw) / 2;
    const offY = (box.height - dh) / 2;
    const cx = clientX - box.left - offX;
    const cy = clientY - box.top - offY;
    if (cx < 0 || cy < 0 || cx > dw || cy > dh) {
      setLens((l) => ({ ...l, show: false }));
      return;
    }
    setLens({
      show: true,
      x: clientX,
      y: clientY,
      bg: `${-(cx * ZOOM - LENS / 2)}px ${-(cy * ZOOM - LENS / 2)}px`,
      size: `${dw * ZOOM}px ${dh * ZOOM}px`,
      src,
    });
  }
  const hideLens = () => setLens((l) => ({ ...l, show: false }));

  /** In split mode the after layer is clipped to the right of the divider. */
  function splitSideAt(clientX: number): "before" | "after" {
    const el = splitRef.current;
    if (!el) return "after";
    const r = el.getBoundingClientRect();
    return ((clientX - r.left) / r.width) * 100 < pct ? "before" : "after";
  }

  const noDrag = {
    draggable: false,
    onDragStart: (e: React.DragEvent) => e.preventDefault(),
  };

  // Backdrop applied to any surface that sits behind the transparent "after".
  const matteClass = transparent && matte === "checker" ? "b-checker" : "";
  const matteStyle: React.CSSProperties | undefined =
    transparent && matte !== "checker" ? { background: MATTE_BG[matte] } : undefined;

  const MODES: { id: Mode; label: string }[] = [
    { id: "hold", label: "Результат" },
    { id: "split", label: "Ползунок" },
    { id: "side", label: "Рядом" },
  ];

  return (
    <div className="cmp">
      <div className="cmp-bar">
        <div className="cmp-left">
          <div className="cmp-modes">
            {MODES.map((m) => (
              <button
                key={m.id}
                className={mode === m.id ? "active" : ""}
                onClick={() => {
                  setMode(m.id);
                  setHolding(false);
                  hideLens();
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
          <button
            className={`cmp-tool ${loupe ? "active" : ""}`}
            onClick={() => {
              setLoupe((v) => !v);
              hideLens();
            }}
            title="Лупа включается сама при наведении на изображение"
          >
            🔍 Лупа
          </button>
          {transparent && (
            <div className="cmp-matte" role="group" aria-label="Подложка">
              <span className="cmp-matte-lbl">Фон:</span>
              <button
                className={`m-chk ${matte === "checker" ? "active" : ""}`}
                onClick={() => setMatte("checker")}
                title="Шахматная (прозрачность)"
              />
              <button
                className={`m-wht ${matte === "white" ? "active" : ""}`}
                onClick={() => setMatte("white")}
                title="Белая подложка"
              />
              <button
                className={`m-blk ${matte === "black" ? "active" : ""}`}
                onClick={() => setMatte("black")}
                title="Чёрная подложка"
              />
            </div>
          )}
        </div>
        <div className="cmp-meta">
          {beforeMeta && <span>{beforeMeta}</span>}
          {beforeMeta && afterMeta && <span> → </span>}
          {afterMeta && <b>{afterMeta}</b>}
        </div>
        <button className="b-btn b-btn--yellow" onClick={() => setFull(true)}>
          ⛶ Fullscreen
        </button>
      </div>

      {mode === "hold" && (
        <div
          className={`cmp-hold ${loupe ? "loupe-on" : ""} ${!holding ? matteClass : ""}`}
          style={!holding ? matteStyle : undefined}
          onPointerDown={(e) => {
            try {
              (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
            } catch {
              // Not a live pointer (or capture refused) — holding still works.
            }
            setHolding(true);
          }}
          onPointerUp={() => setHolding(false)}
          onPointerCancel={() => setHolding(false)}
          onMouseMove={(e) =>
            onLoupeMove(
              e.clientX,
              e.clientY,
              holdImgRef.current,
              holding ? beforeUrl : afterUrl,
            )
          }
          onMouseLeave={() => {
            setHolding(false);
            hideLens();
          }}
        >
          <img
            ref={holdImgRef}
            src={holding ? beforeUrl : afterUrl}
            alt={holding ? "before" : "after"}
            {...noDrag}
          />
          <span className={`cmp-tag ${holding ? "before" : "after"}`}>
            {holding ? beforeLabel : afterLabel}
          </span>
          {!holding && <span className="cmp-hint">зажмите, чтобы сравнить</span>}
        </div>
      )}

      {mode === "split" && (
        <div
          className={`cmp-split ${loupe ? "loupe-on" : ""}`}
          ref={splitRef}
          onPointerDown={(e) => {
            try {
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            } catch {
              // Dragging still works without capture.
            }
            moveTo(e.clientX);
          }}
          onPointerMove={(e) => {
            if (e.buttons === 1) moveTo(e.clientX);
          }}
          onMouseMove={(e) => {
            const side = splitSideAt(e.clientX);
            onLoupeMove(
              e.clientX,
              e.clientY,
              side === "before" ? beforeImgRef.current : afterImgRef.current,
              side === "before" ? beforeUrl : afterUrl,
            );
          }}
          onMouseLeave={hideLens}
        >
          <div className="layer before">
            <img ref={beforeImgRef} src={beforeUrl} alt="before" {...noDrag} />
          </div>
          <div
            className={`layer after ${matteClass}`}
            style={{ clipPath: `inset(0 0 0 ${pct}%)`, ...matteStyle }}
          >
            <img ref={afterImgRef} src={afterUrl} alt="after" {...noDrag} />
          </div>
          <div className="divider" style={{ left: `${pct}%` }} />
          <div className="handle" style={{ left: `${pct}%` }}>
            <i />
            <i />
          </div>
          <span className="cmp-tag before">{beforeLabel}</span>
          <span className="cmp-tag after">{afterLabel}</span>
        </div>
      )}

      {mode === "side" && (
        <div className="cmp-side">
          <figure>
            <div
              className={`cmp-img-wrap ${loupe ? "loupe-on" : ""}`}
              onMouseMove={(e) =>
                onLoupeMove(e.clientX, e.clientY, beforeImgRef.current, beforeUrl)
              }
              onMouseLeave={hideLens}
            >
              <img ref={beforeImgRef} src={beforeUrl} alt="before" {...noDrag} />
            </div>
            <figcaption className="cmp-cap">
              <span>{beforeLabel}</span>
              {beforeMeta && <span>{beforeMeta}</span>}
            </figcaption>
          </figure>
          <figure>
            <div
              className={`cmp-img-wrap ${loupe ? "loupe-on" : ""} ${matteClass}`}
              style={matteStyle}
              onMouseMove={(e) =>
                onLoupeMove(e.clientX, e.clientY, afterImgRef.current, afterUrl)
              }
              onMouseLeave={hideLens}
            >
              <img ref={afterImgRef} src={afterUrl} alt="after" {...noDrag} />
            </div>
            <figcaption className="cmp-cap">
              <span>{afterLabel}</span>
              {afterMeta && <span>{afterMeta}</span>}
            </figcaption>
          </figure>
        </div>
      )}

      {/* Portal to <body>: a fixed lens inside .cmp gets offset by WKWebView's
          animation-induced containing block, so render it at the document root. */}
      {loupe &&
        lens.show &&
        createPortal(
          <div
            className={`loupe ${lens.src === afterUrl && matte === "checker" ? "b-checker" : ""}`}
            style={{
              left: lens.x,
              top: lens.y,
              width: LENS,
              height: LENS,
              backgroundImage: `url(${lens.src})`,
              backgroundSize: lens.size,
              backgroundPosition: lens.bg,
              // Solid backdrop behind the magnified cut-out (not the `background`
              // shorthand — that would wipe out backgroundImage above).
              backgroundColor:
                lens.src === afterUrl && transparent && matte !== "checker"
                  ? MATTE_BG[matte]
                  : undefined,
            }}
          >
            <span className="loupe-cross" />
          </div>,
          document.body,
        )}

      {full && (
        <div
          className={`lightbox ${matteClass}`}
          style={matteStyle}
          onClick={() => setFull(false)}
        >
          <img src={afterUrl} alt="result" {...noDrag} />
          <button
            className="b-btn b-btn--yellow close"
            onClick={(e) => {
              e.stopPropagation();
              setFull(false);
            }}
          >
            × Закрыть
          </button>
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useStrings } from "../lib/i18n";
import { MattePicker } from "./MattePicker";
import { type Matte, MATTE_SOLID, matteStyle } from "../lib/matteBg";

interface Props {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
  beforeMeta?: ReactNode;
  afterMeta?: ReactNode;
  /** the "after" image has transparency (a cut-out) — checker is the sane default */
  transparent?: boolean;
  /** Controlled matte (shared with the tool's single-view). Uncontrolled if omitted. */
  matte?: Matte;
  onMatte?: (m: Matte) => void;
}

/**
 * hold  — result on screen, press and hold to peek at the original (default)
 * split — draggable divider
 * side  — the two images next to each other
 */
type Mode = "hold" | "split" | "side";

/** Everything needed to paint one frame of the magnifier, straight to the DOM. */
interface LoupePaint {
  x: number;
  y: number;
  pos: string;
  size: string;
  src: string;
  matteColor: string | null;
  checker: boolean;
}

const LENS = 150; // px diameter
const ZOOM = 3;

export function Compare({
  beforeUrl,
  afterUrl,
  beforeLabel,
  afterLabel,
  beforeMeta,
  afterMeta,
  transparent,
  matte: matteProp,
  onMatte,
}: Props) {
  const s = useStrings();
  beforeLabel ??= s.compare.before;
  afterLabel ??= s.compare.after;
  const [mode, setMode] = useState<Mode>("split");
  const [pct, setPct] = useState(50);
  const [full, setFull] = useState(false);
  // Backdrop behind the preview. Letterbox for an opaque result, seen through a
  // transparent cut-out. Controlled by the parent tool when props are passed
  // (so the picker is shared with the single-view); otherwise self-managed.
  const [matteInner, setMatteInner] = useState<Matte>(
    transparent ? "checker" : "theme",
  );
  const matte = matteProp ?? matteInner;
  const setMatte = onMatte ?? setMatteInner;
  // Off by default — the loupe is opt-in via the corner toggle.
  const [loupe, setLoupe] = useState(false);
  const [holding, setHolding] = useState(false);

  const splitRef = useRef<HTMLDivElement>(null);
  const afterImgRef = useRef<HTMLImageElement>(null);
  const beforeImgRef = useRef<HTMLImageElement>(null);
  const holdImgRef = useRef<HTMLImageElement>(null);

  // --- Loupe: driven straight to the DOM, never through React state. Writing
  // setState on every mousemove re-rendered the whole component and lagged; here
  // the magnifier is one persistent node whose style we patch inside a single
  // rAF per frame. ---
  const loupeRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const paintRef = useRef<LoupePaint | null>(null);
  // Last cursor position over a stage, so we can re-magnify when the image swaps
  // under a still cursor (hold mode) without waiting for the next move.
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  function schedulePaint() {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const el = loupeRef.current;
      if (!el) return;
      const n = paintRef.current;
      if (!n) {
        el.style.display = "none";
        return;
      }
      el.style.display = "block";
      el.style.left = `${n.x}px`;
      el.style.top = `${n.y}px`;
      if (n.checker) {
        // The zoomed photo is the top background layer; two checker gradients
        // sit below it, so transparent pixels reveal the checkerboard (not the
        // element's own fill). A single backgroundImage would hide the checker.
        const ck =
          "linear-gradient(45deg,#d8d8d8 25%,transparent 25%,transparent 75%,#d8d8d8 75%)";
        el.style.backgroundImage = `url("${n.src}"), ${ck}, ${ck}`;
        el.style.backgroundSize = `${n.size}, 20px 20px, 20px 20px`;
        el.style.backgroundPosition = `${n.pos}, 0 0, 10px 10px`;
        // The photo layer must not tile, but the checker gradients must — the
        // element's blanket `no-repeat` would otherwise leave one lonely tile.
        el.style.backgroundRepeat = "no-repeat, repeat, repeat";
        el.style.backgroundColor = "#fff";
      } else {
        el.style.backgroundImage = `url("${n.src}")`;
        el.style.backgroundSize = n.size;
        el.style.backgroundPosition = n.pos;
        el.style.backgroundRepeat = "no-repeat";
        el.style.backgroundColor = n.matteColor ?? "";
      }
    });
  }

  // Object-fit: contain aware geometry. Returns null when the loupe should be
  // hidden (off the image, or the toggle is off).
  function computeLoupe(
    clientX: number,
    clientY: number,
    img: HTMLImageElement | null,
    src: string,
  ): LoupePaint | null {
    if (!loupe || !img) return null;
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
    if (cx < 0 || cy < 0 || cx > dw || cy > dh) return null;
    const isAfter = src === afterUrl;
    return {
      x: clientX,
      y: clientY,
      pos: `${-(cx * ZOOM - LENS / 2)}px ${-(cy * ZOOM - LENS / 2)}px`,
      size: `${dw * ZOOM}px ${dh * ZOOM}px`,
      src,
      matteColor:
        isAfter && (matte === "white" || matte === "black")
          ? MATTE_SOLID[matte]
          : null,
      checker: !!(isAfter && matte === "checker"),
    };
  }

  // Recompute + repaint the loupe, and swap the stage cursor: the OS pointer is
  // hidden (cursor:none, via .loupe-on) only while the lens is actually up, and
  // comes back the moment it hides — so controls under the image stay usable.
  function moveLoupe(
    stage: HTMLElement,
    clientX: number,
    clientY: number,
    img: HTMLImageElement | null,
    src: string,
    cursorWhenHidden = "default",
  ) {
    lastPos.current = { x: clientX, y: clientY };
    const n = computeLoupe(clientX, clientY, img, src);
    paintRef.current = n;
    stage.style.cursor = n ? "" : cursorWhenHidden;
    schedulePaint();
  }

  function hideLoupe(stage?: HTMLElement) {
    paintRef.current = null;
    lastPos.current = null;
    if (stage) stage.style.cursor = "default";
    schedulePaint();
  }

  // Cancel any pending frame on unmount.
  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

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
    if (mode !== "hold") return;
    const p = lastPos.current;
    if (!p) return;
    paintRef.current = computeLoupe(
      p.x,
      p.y,
      holdImgRef.current,
      holding ? beforeUrl : afterUrl,
    );
    schedulePaint();
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

  // Backdrop applied to any surface that sits behind the "after" preview
  // (letterbox for an opaque result, seen through a transparent cut-out).
  const mStyle = matteStyle(matte);

  const MODES: { id: Mode; label: string }[] = [
    { id: "split", label: s.compare.modeSplit },
    { id: "hold", label: s.compare.modeHold },
    { id: "side", label: s.compare.modeSide },
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
                  hideLoupe();
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
          <MattePicker value={matte} onChange={setMatte} />
        </div>
        <div className="cmp-meta">
          {beforeMeta && <span>{beforeMeta}</span>}
          {beforeMeta && afterMeta && <span> → </span>}
          {afterMeta && <b>{afterMeta}</b>}
        </div>
        <button className="b-btn b-btn--yellow" onClick={() => setFull(true)}>
          {s.compare.fullscreen}
        </button>
      </div>

      {mode === "hold" && (
        <div
          className={`cmp-hold ${loupe ? "loupe-on" : ""}`}
          style={mStyle}
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
            moveLoupe(
              e.currentTarget,
              e.clientX,
              e.clientY,
              holdImgRef.current,
              holding ? beforeUrl : afterUrl,
            )
          }
          onMouseLeave={(e) => {
            setHolding(false);
            hideLoupe(e.currentTarget);
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
          {!holding && <span className="cmp-hint">{s.compare.holdHint}</span>}
        </div>
      )}

      {mode === "split" && (
        <div
          className={`cmp-split ${loupe ? "loupe-on" : ""}`}
          style={mStyle}
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
            // Near the divider the loupe just covers the handle you're trying to
            // grab — hide it and show the resize cursor there instead.
            const el = splitRef.current;
            if (el) {
              const r = el.getBoundingClientRect();
              const dividerX = r.left + (pct / 100) * r.width;
              if (Math.abs(e.clientX - dividerX) <= 24) {
                paintRef.current = null;
                e.currentTarget.style.cursor = "ew-resize";
                schedulePaint();
                return;
              }
            }
            const side = splitSideAt(e.clientX);
            moveLoupe(
              e.currentTarget,
              e.clientX,
              e.clientY,
              side === "before" ? beforeImgRef.current : afterImgRef.current,
              side === "before" ? beforeUrl : afterUrl,
              "ew-resize",
            );
          }}
          onMouseLeave={(e) => hideLoupe(e.currentTarget)}
        >
          <div className="layer before">
            <img ref={beforeImgRef} src={beforeUrl} alt="before" {...noDrag} />
          </div>
          <div
            className="layer after"
            style={{ clipPath: `inset(0 0 0 ${pct}%)`, ...mStyle }}
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
              style={mStyle}
              onMouseMove={(e) =>
                moveLoupe(
                  e.currentTarget,
                  e.clientX,
                  e.clientY,
                  beforeImgRef.current,
                  beforeUrl,
                )
              }
              onMouseLeave={(e) => hideLoupe(e.currentTarget)}
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
              className={`cmp-img-wrap ${loupe ? "loupe-on" : ""}`}
              style={mStyle}
              onMouseMove={(e) =>
                moveLoupe(
                  e.currentTarget,
                  e.clientX,
                  e.clientY,
                  afterImgRef.current,
                  afterUrl,
                )
              }
              onMouseLeave={(e) => hideLoupe(e.currentTarget)}
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

      {/* Loupe toggle — floating in the stage's bottom-left corner. */}
      <button
        className={`cmp-loupe-fab ${loupe ? "active" : ""}`}
        onClick={() => {
          setLoupe((v) => !v);
          hideLoupe();
        }}
        title={s.compare.loupeTitle}
        aria-pressed={loupe}
      >
        🔍
      </button>

      {/* One persistent lens node, patched imperatively in schedulePaint (never
          re-rendered by React). Portaled to <body>: a fixed lens inside .cmp gets
          offset by WKWebView's animation-induced containing block. */}
      {loupe &&
        createPortal(
          <div
            ref={loupeRef}
            className="loupe"
            style={{ display: "none", width: LENS, height: LENS }}
          >
            <span className="loupe-cross" />
          </div>,
          document.body,
        )}

      {full && (
        <div
          className="lightbox"
          style={mStyle}
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
            {s.compare.close}
          </button>
        </div>
      )}
    </div>
  );
}

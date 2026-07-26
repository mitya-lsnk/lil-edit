import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  canvasToPngBytes,
  canvasToPngFile,
  cropCanvas,
  flipCanvas,
  imageToCanvas,
  loadImageFromFile,
  resizeCanvas,
  rotateCanvas,
  type CropRect,
} from "../lib/edit";
import { saveBytes } from "../lib/save";
import { PipeButtons } from "./PipeButtons";
import { MattePicker } from "./MattePicker";
import { type Matte, matteStyle } from "../lib/matteBg";
import type { Tool } from "./HomeScreen";
import { useStrings } from "../lib/i18n";

interface Props {
  file: File;
  srcDir: string | null;
  onSendTo: (file: File, tool: Tool) => void;
  onSaved: (path: string) => void;
}

// Crop aspect presets — just the basics; anything else goes in the custom field.
// `r` is a pixel width/height ratio; null means free-form.
const RATIOS: { key: string; r: number | null }[] = [
  { key: "free", r: null },
  { key: "1:1", r: 1 },
  { key: "16:9", r: 16 / 9 },
];

// Parse a "W:H" / "W/H" / "WxH" ratio string; returns w/h or null if invalid.
function parseRatio(str: string): number | null {
  const m = str.trim().match(/^(\d+(?:\.\d+)?)\s*[:/xх]\s*(\d+(?:\.\d+)?)$/i);
  if (!m) return null;
  const w = Number(m[1]);
  const h = Number(m[2]);
  return w > 0 && h > 0 ? w / h : null;
}

const MAX_STAGE_H = 460; // preview height cap, px
const MIN_CROP = 0.05; // smallest crop side, normalised

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

const FULL: CropRect = { x: 0, y: 0, w: 1, h: 1 };

export function EditPanel({ file, srcDir, onSendTo, onSaved }: Props) {
  const s = useStrings();

  // Undo stack: each edit pushes a new canvas; `pos` points at the current one.
  const [stack, setStack] = useState<HTMLCanvasElement[]>([]);
  const [pos, setPos] = useState(0);
  const cur = stack[pos] ?? null;

  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const urlRef = useRef("");

  // Resize controls. Fields are strings so they can be emptied while typing
  // (a plain number field snaps a cleared box back to 0).
  // Preview backdrop, like Remove BG. Default "theme" = show the theme colour.
  const [matte, setMatte] = useState<Matte>("theme");
  const [unit, setUnit] = useState<"px" | "pct">("px");
  const [wField, setWField] = useState("");
  const [hField, setHField] = useState("");
  const [pctField, setPctField] = useState("100");
  const [lockRatio, setLockRatio] = useState(true);

  // Crop controls.
  const [cropping, setCropping] = useState(false);
  const [crop, setCrop] = useState<CropRect>(FULL);
  const aspectRef = useRef<number | null>(null); // normalised w/h lock
  const [ratioKey, setRatioKey] = useState("free");
  const [customStr, setCustomStr] = useState("");

  // Stage geometry (the on-screen image rect the crop overlay maps onto).
  const stageRef = useRef<HTMLDivElement>(null);
  const [boxW, setBoxW] = useState(0);

  // Pointer drag state for the crop box and its corner handles. Declared with
  // the other hooks (above the early returns) so hook order stays stable.
  const dragRef = useRef<{
    mode: string;
    rect: CropRect;
    spx: number;
    spy: number;
    box: DOMRect;
  } | null>(null);

  // ---- load / reset when the source file changes ----
  useEffect(() => {
    let alive = true;
    setError(null);
    setCropping(false);
    loadImageFromFile(file)
      .then((img) => {
        if (!alive) return;
        setStack([imageToCanvas(img)]);
        setPos(0);
      })
      .catch((e) => alive && setError(String(e)));
    return () => {
      alive = false;
    };
  }, [file]);

  // ---- keep the preview URL in sync with the current canvas ----
  useEffect(() => {
    if (!cur) return;
    let alive = true;
    cur.toBlob((b) => {
      if (!b || !alive) return;
      const u = URL.createObjectURL(b);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = u;
      setPreviewUrl(u);
    }, "image/png");
    return () => {
      alive = false;
    };
  }, [cur]);
  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  // ---- sync the resize fields to the current canvas dimensions ----
  useEffect(() => {
    if (!cur) return;
    setWField(String(cur.width));
    setHField(String(cur.height));
    setPctField("100");
  }, [cur]);

  // ---- measure the stage width so the overlay lines up with the image ----
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => setBoxW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (error && !cur) return <div className="b-error">{error}</div>;
  if (!cur) return <div className="single-view" style={{ minHeight: 200 }} />;

  const baseAspect = cur.width / cur.height;
  // On-screen image size: fill the stage width, capped by height.
  let dispW = boxW || cur.width;
  let dispH = dispW / baseAspect;
  if (dispH > MAX_STAGE_H) {
    dispH = MAX_STAGE_H;
    dispW = dispH * baseAspect;
  }

  function pushCanvas(next: HTMLCanvasElement) {
    setStack((prev) => [...prev.slice(0, pos + 1), next]);
    setPos((p) => p + 1);
  }

  // ---- rotate / flip (immediate) ----
  const doRotate = (deg: 90 | -90 | 180) => pushCanvas(rotateCanvas(cur!, deg));
  const doFlip = (axis: "h" | "v") => pushCanvas(flipCanvas(cur!, axis));

  // ---- undo / redo / reset ----
  const canUndo = pos > 0;
  const canRedo = pos < stack.length - 1;
  const undo = () => canUndo && setPos((p) => p - 1);
  const redo = () => canRedo && setPos((p) => p + 1);
  const reset = () => setPos(0);

  // ---- resize ----
  function applyResize() {
    if (!cur) return;
    let w: number;
    let h: number;
    if (unit === "pct") {
      const p = Number(pctField);
      if (!Number.isFinite(p) || p <= 0) return;
      w = Math.round((cur.width * p) / 100);
      h = Math.round((cur.height * p) / 100);
    } else {
      w = Math.round(Number(wField));
      h = Math.round(Number(hField));
      if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1) return;
    }
    if (w === cur.width && h === cur.height) return;
    pushCanvas(resizeCanvas(cur, w, h));
  }

  function onWidth(v: string) {
    setWField(v);
    const n = Number(v);
    if (lockRatio && v !== "" && n > 0)
      setHField(String(Math.max(1, Math.round(n / baseAspect))));
  }
  function onHeight(v: string) {
    setHField(v);
    const n = Number(v);
    if (lockRatio && v !== "" && n > 0)
      setWField(String(Math.max(1, Math.round(n * baseAspect))));
  }

  // ---- crop ----
  function fitToAspect(pixelRatio: number | null): CropRect {
    if (!cur || pixelRatio == null) return FULL;
    // Convert pixel ratio to a normalised aspect (accounts for image shape).
    const a = pixelRatio * (cur.height / cur.width);
    let w = 1;
    let h = w / a;
    if (h > 1) {
      h = 1;
      w = h * a;
    }
    return { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
  }

  function chooseRatio(key: string, r: number | null) {
    setRatioKey(key);
    if (key !== "custom") setCustomStr("");
    if (r == null) {
      aspectRef.current = null;
      return;
    }
    aspectRef.current = r * (cur!.height / cur!.width);
    setCrop(fitToAspect(r));
  }

  function onCustom(v: string) {
    setCustomStr(v);
    const r = parseRatio(v);
    if (r) {
      setRatioKey("custom");
      aspectRef.current = r * (cur!.height / cur!.width);
      setCrop(fitToAspect(r));
    }
  }

  function startCrop() {
    setCrop(FULL);
    aspectRef.current = null;
    setRatioKey("free");
    setCustomStr("");
    setCropping(true);
  }

  function applyCrop() {
    if (cur && (crop.w < 1 || crop.h < 1)) pushCanvas(cropCanvas(cur, crop));
    setCropping(false);
  }

  // Pointer drag for the crop box and its corner handles.
  function onDown(e: React.PointerEvent, mode: string) {
    e.preventDefault();
    e.stopPropagation();
    const wrap = (e.currentTarget as HTMLElement).closest(
      ".edit-canvas-wrap",
    ) as HTMLElement | null;
    if (!wrap) return;
    const box = wrap.getBoundingClientRect();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      mode,
      rect: { ...crop },
      spx: (e.clientX - box.left) / box.width,
      spy: (e.clientY - box.top) / box.height,
      box,
    };
  }

  function onDrag(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    const px = clamp((e.clientX - d.box.left) / d.box.width, 0, 1);
    const py = clamp((e.clientY - d.box.top) / d.box.height, 0, 1);
    if (d.mode === "move") {
      const nx = clamp(d.rect.x + (px - d.spx), 0, 1 - d.rect.w);
      const ny = clamp(d.rect.y + (py - d.spy), 0, 1 - d.rect.h);
      setCrop({ ...d.rect, x: nx, y: ny });
    } else if (d.mode.length === 1) {
      // Single-axis edge handles (n/s/e/w) — free crop only.
      setCrop(resizeEdge(d.rect, d.mode, px, py));
    } else {
      setCrop(resizeCorner(d.rect, d.mode, px, py, aspectRef.current));
    }
  }

  function onUp(e: React.PointerEvent) {
    if (dragRef.current) {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      dragRef.current = null;
    }
  }

  const dragProps = { onPointerMove: onDrag, onPointerUp: onUp };

  const outW = cur.width;
  const outH = cur.height;

  return (
    <div className="edit-panel">
      {cropping ? (
        /* ---------- crop: one merged block ---------- */
        <div className="t-controls edit-crop-merged">
          <div className="edit-ops">
            <button className="b-btn edit-icn" title={s.edit.rotateL} onClick={() => doRotate(-90)}>↺</button>
            <button className="b-btn edit-icn" title={s.edit.rotateR} onClick={() => doRotate(90)}>↻</button>
            <button className="b-btn edit-icn" title={s.edit.flipH} onClick={() => doFlip("h")}>⇋</button>
            <button className="b-btn edit-icn" title={s.edit.flipV} onClick={() => doFlip("v")}>⥯</button>
          </div>
          <div className="edit-ratios">
            {RATIOS.map((rt) => (
              <button
                key={rt.key}
                className={ratioKey === rt.key ? "active" : ""}
                onClick={() => chooseRatio(rt.key, rt.r)}
              >
                {rt.key === "free" ? s.edit.free : rt.key}
              </button>
            ))}
          </div>
          <input
            className={`t-num edit-custom ${ratioKey === "custom" ? "active" : ""}`}
            placeholder="16:9"
            value={customStr}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => onCustom(e.target.value)}
          />
          <span className="edit-dims">{outW} × {outH}</span>
          <MattePicker value={matte} onChange={setMatte} />
          <span className="head-spacer" style={{ flex: 1 }} />
          <button className="b-btn edit-icn" title={s.edit.undo} disabled={!canUndo} onClick={undo}>⟲</button>
          <button className="b-btn edit-icn" title={s.edit.redo} disabled={!canRedo} onClick={redo}>⟳</button>
          <button className="b-btn" onClick={() => setCropping(false)}>{s.edit.cancel}</button>
          <button className="b-btn b-btn--solid" onClick={applyCrop}>{s.edit.apply}</button>
        </div>
      ) : (
        /* ---------- default: toolbar + resize ---------- */
        <>
          <div className="t-controls edit-bar">
            <div className="edit-ops">
              <button className="b-btn edit-icn" title={s.edit.rotateL} onClick={() => doRotate(-90)}>↺</button>
              <button className="b-btn edit-icn" title={s.edit.rotateR} onClick={() => doRotate(90)}>↻</button>
              <button className="b-btn edit-icn" title={s.edit.flipH} onClick={() => doFlip("h")}>⇋</button>
              <button className="b-btn edit-icn" title={s.edit.flipV} onClick={() => doFlip("v")}>⥯</button>
            </div>
            <span className="edit-dims">{outW} × {outH}</span>
            <MattePicker value={matte} onChange={setMatte} />
            <span className="head-spacer" style={{ flex: 1 }} />
            <div className="edit-ops">
              <button className="b-btn edit-icn" title={s.edit.undo} disabled={!canUndo} onClick={undo}>⟲</button>
              <button className="b-btn edit-icn" title={s.edit.redo} disabled={!canRedo} onClick={redo}>⟳</button>
              <button className="b-btn" disabled={!canUndo} onClick={reset}>{s.edit.reset}</button>
            </div>
          </div>

          <div className="t-controls edit-resize-bar">
            <div className="t-seg edit-unit">
              <button className={unit === "px" ? "active" : ""} onClick={() => setUnit("px")}>{s.edit.unitPx}</button>
              <button className={unit === "pct" ? "active" : ""} onClick={() => setUnit("pct")}>{s.edit.unitPct}</button>
            </div>

            {unit === "px" ? (
              <>
                <label className="edit-num">
                  <span className="t-label">{s.edit.width}</span>
                  <input className="t-num" type="number" min={1} value={wField}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => onWidth(e.target.value)} />
                </label>
                <span className="edit-x">×</span>
                <label className="edit-num">
                  <span className="t-label">{s.edit.height}</span>
                  <input className="t-num" type="number" min={1} value={hField}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => onHeight(e.target.value)} />
                </label>
                <label className="t-check edit-lock">
                  <input type="checkbox" checked={lockRatio} onChange={(e) => setLockRatio(e.target.checked)} />
                  {s.edit.lock}
                </label>
              </>
            ) : (
              <label className="edit-num">
                <span className="t-label">{s.edit.percent} · {pctField || 0}%</span>
                <input className="t-num" type="number" min={1} max={1000} value={pctField}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => setPctField(e.target.value)} />
              </label>
            )}

            <span className="head-spacer" style={{ flex: 1 }} />
            <button className="b-btn" onClick={startCrop}>✂ {s.edit.crop}</button>
            <button className="b-btn b-btn--solid" onClick={applyResize}>{s.edit.applyResize}</button>
          </div>
        </>
      )}

      {error && <div className="b-error">{error}</div>}

      {/* ---------- preview + crop overlay ---------- */}
      <div
        className="edit-stage"
        style={matteStyle(matte)}
        ref={stageRef}
      >
        <div
          className="edit-canvas-wrap"
          style={{ width: dispW, height: dispH, ...matteStyle(matte) }}
        >
          {previewUrl && <img src={previewUrl} alt="" draggable={false} style={{ width: "100%", height: "100%" }} />}

          {cropping && (
            <>
              <div
                className="crop-box"
                style={{
                  left: `${crop.x * 100}%`,
                  top: `${crop.y * 100}%`,
                  width: `${crop.w * 100}%`,
                  height: `${crop.h * 100}%`,
                }}
                onPointerDown={(e) => onDown(e, "move")}
                {...dragProps}
              >
                <span className="crop-third v1" />
                <span className="crop-third v2" />
                <span className="crop-third h1" />
                <span className="crop-third h2" />
                {(["nw", "ne", "sw", "se"] as const).map((c) => (
                  <span
                    key={c}
                    className={`crop-handle ${c}`}
                    onPointerDown={(e) => onDown(e, c)}
                    {...dragProps}
                  />
                ))}
                {/* Edge-midpoint handles — free crop only (they'd break a locked
                    aspect ratio). */}
                {ratioKey === "free" &&
                  (["n", "s", "e", "w"] as const).map((c) => (
                    <span
                      key={c}
                      className={`crop-handle edge ${c}`}
                      onPointerDown={(e) => onDown(e, c)}
                      {...dragProps}
                    />
                  ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ---------- save / pipe ---------- */}
      <div className="t-actions">
        <button className="b-btn b-btn--yellow" onClick={onSave}>{s.edit.save}</button>
        <PipeButtons current="edit" onSend={pipe} />
      </div>
    </div>
  );

  async function onSave() {
    if (!cur) return;
    try {
      const bytes = await canvasToPngBytes(cur);
      const base = file.name.replace(/\.[^.]+$/, "");
      const path = await saveBytes(bytes, `${base}-edit.png`, "png", srcDir);
      if (path) onSaved(path);
    } catch (e) {
      setError(String(e));
    }
  }

  async function pipe(tool: Tool) {
    if (!cur) return;
    const base = file.name.replace(/\.[^.]+$/, "");
    onSendTo(await canvasToPngFile(cur, `${base}-edit.png`), tool);
  }
}

// Resize a crop rect by dragging one edge midpoint (free crop, single axis).
function resizeEdge(
  r: CropRect,
  mode: string,
  px: number,
  py: number,
): CropRect {
  let { x, y, w, h } = r;
  if (mode === "n") {
    const bottom = y + h;
    y = clamp(py, 0, bottom - MIN_CROP);
    h = bottom - y;
  } else if (mode === "s") {
    h = clamp(py, y + MIN_CROP, 1) - y;
  } else if (mode === "w") {
    const right = x + w;
    x = clamp(px, 0, right - MIN_CROP);
    w = right - x;
  } else if (mode === "e") {
    w = clamp(px, x + MIN_CROP, 1) - x;
  }
  return { x, y, w, h };
}

// Resize a crop rect by dragging one corner; the opposite corner stays anchored.
// `a` (normalised w/h) locks the aspect when set. Everything stays inside [0,1].
function resizeCorner(
  r: CropRect,
  mode: string,
  px: number,
  py: number,
  a: number | null,
): CropRect {
  const ax = mode.includes("w") ? r.x + r.w : r.x; // fixed x edge
  const ay = mode.includes("n") ? r.y + r.h : r.y; // fixed y edge
  let w = Math.abs(px - ax);
  let h = Math.abs(py - ay);
  if (a) {
    if (w >= h * a) h = w / a;
    else w = h * a;
  }
  const signX = px >= ax ? 1 : -1;
  const signY = py >= ay ? 1 : -1;
  const maxW = signX > 0 ? 1 - ax : ax;
  const maxH = signY > 0 ? 1 - ay : ay;
  if (w > maxW) {
    w = maxW;
    if (a) h = w / a;
  }
  if (h > maxH) {
    h = maxH;
    if (a) w = h * a;
  }
  if (w > maxW) {
    w = maxW;
    if (a) h = w / a;
  }
  w = Math.max(MIN_CROP, w);
  h = Math.max(MIN_CROP, h);
  const x = signX > 0 ? ax : ax - w;
  const y = signY > 0 ? ay : ay - h;
  return { x: clamp(x, 0, 1 - w), y: clamp(y, 0, 1 - h), w, h };
}

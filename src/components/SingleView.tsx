import type { ReactNode } from "react";
import { MattePicker } from "./MattePicker";
import { type Matte, matteStyle } from "../lib/matteBg";

/**
 * The pre-processing preview: a single framed image with a caption, plus the
 * same backdrop ("matte") picker the Compare view uses — so the chosen backdrop
 * is already in effect before you run the tool, not only after. Shared by
 * Upscale / Compress / Remove BG so the before/after backdrops stay in sync.
 */
export function SingleView({
  url,
  label,
  meta,
  alt = "",
  matte,
  onMatte,
}: {
  url: string;
  label: ReactNode;
  meta?: ReactNode;
  alt?: string;
  matte: Matte;
  onMatte: (m: Matte) => void;
}) {
  return (
    <div className="single-view">
      <div className="cmp-img-wrap" style={matteStyle(matte)}>
        {url && <img src={url} alt={alt} />}
      </div>
      <div className="single-cap">
        <div className="single-cap-info">
          <span>{label}</span>
          {meta != null && <span>{meta}</span>}
        </div>
        <MattePicker value={matte} onChange={onMatte} />
      </div>
    </div>
  );
}

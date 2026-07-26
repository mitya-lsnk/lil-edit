// Shared backdrop ("matte") behind a preview image — used by Compare, the
// single-view previews and the Edit stage. "theme" means no matte at all: the
// themed stage surface shows through in the current skin/mode. checker/white/
// black force a fixed backdrop so leftover fringes on a cut-out (and the
// letterbox around a contained image) are visible against a known colour.

import type { CSSProperties } from "react";

export type Matte = "theme" | "checker" | "white" | "black";

export const MATTE_SOLID: Record<"white" | "black", string> = {
  white: "#ffffff",
  black: "#111111",
};

const CHECKER =
  "linear-gradient(45deg,#d8d8d8 25%,transparent 25%,transparent 75%,#d8d8d8 75%)";

/**
 * Inline background for a matte. Returned as inline style (not a class) on
 * purpose: the preview stages carry skin/mode-specific `background` rules
 * (`.cmp-split`, `.cmp-img-wrap`, riso halftone, te screen…) that would beat a
 * utility class on specificity. An inline style wins over all of them, so the
 * chosen matte always takes effect. `theme` returns nothing → the themed stage
 * background shows through unchanged.
 */
export function matteStyle(m: Matte): CSSProperties | undefined {
  if (m === "white") return { background: MATTE_SOLID.white };
  if (m === "black") return { background: MATTE_SOLID.black };
  if (m === "checker")
    return {
      backgroundImage: `${CHECKER}, ${CHECKER}`,
      backgroundSize: "20px 20px",
      backgroundPosition: "0 0, 10px 10px",
      backgroundColor: "#fff",
    };
  return undefined;
}

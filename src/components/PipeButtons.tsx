import { useStrings } from "../lib/i18n";
import type { Tool } from "./HomeScreen";

const TOOLS: Tool[] = ["upscale", "background", "edit", "compress"];

/**
 * "Next: [other tool] →" row shown next to Save. Hands the current result
 * straight into another tool as its input, so a user can chain upscale →
 * remove bg → compress without saving and re-opening between steps.
 */
export function PipeButtons({
  current,
  onSend,
}: {
  current: Tool;
  onSend: (tool: Tool) => void;
}) {
  const s = useStrings();
  const others = TOOLS.filter((t) => t !== current);
  return (
    <div className="t-pipe">
      <span className="t-pipe-lbl">{s.pipe.label}</span>
      {others.map((t) => (
        <button key={t} className="b-btn" onClick={() => onSend(t)}>
          {s.tools[t]} →
        </button>
      ))}
    </div>
  );
}

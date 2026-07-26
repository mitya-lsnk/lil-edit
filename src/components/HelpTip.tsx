/** A small "?" badge that reveals a styled tooltip on hover/focus — used where a
 *  native `title` is too plain (no padding) and shows a text-select cursor. */
export function HelpTip({ tip }: { tip: string }) {
  return (
    <span className="help-tip" tabIndex={0} aria-label={tip}>
      ?<span className="help-tip-bubble" role="tooltip">{tip}</span>
    </span>
  );
}

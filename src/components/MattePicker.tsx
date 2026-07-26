import type { Matte } from "../lib/matteBg";
import { useStrings } from "../lib/i18n";

/** Four backdrop swatches: theme colour (crossed square), checker, white, black. */
export function MattePicker({
  value,
  onChange,
}: {
  value: Matte;
  onChange: (m: Matte) => void;
}) {
  const s = useStrings();
  return (
    <div className="cmp-matte" role="group" aria-label={s.compare.matteAria}>
      <span className="cmp-matte-lbl">{s.compare.matteLabel}</span>
      <button
        className={`m-theme ${value === "theme" ? "active" : ""}`}
        onClick={() => onChange("theme")}
        title={s.compare.matteTheme}
        aria-label={s.compare.matteTheme}
      />
      <button
        className={`m-chk ${value === "checker" ? "active" : ""}`}
        onClick={() => onChange("checker")}
        title={s.compare.matteChecker}
        aria-label={s.compare.matteChecker}
      />
      <button
        className={`m-wht ${value === "white" ? "active" : ""}`}
        onClick={() => onChange("white")}
        title={s.compare.matteWhite}
        aria-label={s.compare.matteWhite}
      />
      <button
        className={`m-blk ${value === "black" ? "active" : ""}`}
        onClick={() => onChange("black")}
        title={s.compare.matteBlack}
        aria-label={s.compare.matteBlack}
      />
    </div>
  );
}

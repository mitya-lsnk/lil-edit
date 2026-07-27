import { useEffect, useMemo } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { splitPath } from "../lib/intake";
import { hasTauri } from "../lib/tauri";
import { useStrings } from "../lib/i18n";

/**
 * Shown after a successful save. Confirms it, offers to open the containing
 * folder (app only — the browser has no real path), and to clear the working
 * image so the next job starts on a clean slate. Auto-dismisses.
 */
export function Toast({
  path,
  tool,
  onClear,
  onClose,
}: {
  path: string;
  /** Which tool produced the file — picks the flavour of the headline. */
  tool?: string | null;
  onClear: () => void;
  onClose: () => void;
}) {
  const s = useStrings();
  const { dir, name } = splitPath(path);

  // One random quip per save, keyed on the path so a re-render doesn't reroll
  // it mid-toast. Falls back to the plain wording if a tool has no pool.
  const title = useMemo(() => {
    const pool = tool ? s.toast.quips[tool] : undefined;
    if (!pool?.length) return s.toast.saved;
    return pool[Math.floor(Math.random() * pool.length)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tool]);
  // A real filesystem path only exists in the app; the browser fallback returns
  // just the download filename, so there's nothing to open there.
  const canOpen = hasTauri() && !!dir;

  useEffect(() => {
    const t = setTimeout(onClose, 8000);
    return () => clearTimeout(t);
  }, [path, onClose]);

  return (
    <div className="toast" role="status">
      <div className="toast-body">
        <span className="toast-check" aria-hidden>
          ✓
        </span>
        <div className="toast-text">
          <div className="toast-title">{title}</div>
          <div className="toast-name" title={path}>
            {name}
          </div>
        </div>
      </div>
      <div className="toast-actions">
        {canOpen && (
          <button className="b-btn" onClick={() => openUrl(`file://${dir}`)}>
            {s.toast.openFolder}
          </button>
        )}
        <button className="b-btn b-btn--solid" onClick={onClear}>
          {s.toast.clear}
        </button>
        <button
          className="toast-x"
          onClick={onClose}
          aria-label={s.toast.close}
          title={s.toast.close}
        >
          ×
        </button>
      </div>
    </div>
  );
}

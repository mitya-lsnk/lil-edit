import { useEffect, useState } from "react";
import { useStrings } from "../lib/i18n";

/**
 * Compact "current file" bar for the tool screens: thumbnail, name, and a
 * Replace button. Without it the only way to swap the image mid-tool was a
 * drag-drop, which isn't discoverable.
 */
export function FileStrip({
  file,
  onReplace,
}: {
  file: File;
  onReplace: () => void;
}) {
  const s = useStrings();
  const [thumb, setThumb] = useState<string | null>(null);

  // StrictMode-safe object URL lifecycle: create + revoke in one effect.
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setThumb(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="loaded-strip tool-strip">
      {thumb && <img className="ls-thumb" src={thumb} alt="" />}
      <div className="ls-info">
        <div className="ls-label">{s.home.loaded}</div>
        <div className="ls-name">{file.name}</div>
      </div>
      <button className="b-btn" onClick={onReplace}>
        {s.home.replace}
      </button>
    </div>
  );
}

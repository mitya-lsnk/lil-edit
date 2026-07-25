import { useEffect, useState } from "react";
import { modelsDirPath } from "../lib/models";
import { hasTauri } from "../lib/tauri";
import { useStrings } from "../lib/i18n";

/**
 * Straight answers about what the app actually loads. The prose lives in
 * strings.tsx (both languages); here we only lay it out. Model names and the
 * numeric weight/input/memory cells are language-neutral, so they stay inline.
 */
export function FaqScreen() {
  const s = useStrings();
  const [dir, setDir] = useState<string>("");
  useEffect(() => {
    if (!hasTauri()) return;
    modelsDirPath()
      .then(setDir)
      .catch(() => setDir(""));
  }, []);

  const bg = s.faq.bgRows;

  return (
    <div className="faq">
      <h2 className="faq-h">{s.faq.heading}</h2>
      <p className="faq-lead">{s.faq.lead}</p>

      <section className="faq-sec">
        <h3>{s.faq.bgTitle}</h3>
        <div className="faq-table">
          <div className="faq-row faq-head">
            <span>{s.faq.bgCols.model}</span>
            <span>{s.faq.bgCols.weight}</span>
            <span>{s.faq.bgCols.input}</span>
            <span>{s.faq.bgCols.memory}</span>
          </div>
          <div className="faq-row">
            <span>
              <b>BiRefNet</b>
              <em>{bg.birefnet}</em>
            </span>
            <span>928 MB</span>
            <span>1024×1024</span>
            <span className="warn">~8 GB</span>
          </div>
          <div className="faq-row">
            <span>
              <b>IS-Net (general)</b>
              <em>{bg.isnet}</em>
            </span>
            <span>170 MB</span>
            <span>1024×1024</span>
            <span>~1 GB</span>
          </div>
          <div className="faq-row">
            <span>
              <b>U²-Net (full)</b>
              <em>{bg.u2netFull}</em>
            </span>
            <span>168 MB</span>
            <span>320×320</span>
            <span>~0.5 GB</span>
          </div>
          <div className="faq-row">
            <span>
              <b>Silueta</b>
              <em>{bg.silueta}</em>
            </span>
            <span>42 MB</span>
            <span>320×320</span>
            <span>~0.3 GB</span>
          </div>
          <div className="faq-row">
            <span>
              <b>U²-Net (lite)</b>
              <em>{bg.u2netLite}</em>
            </span>
            <span>4.4 MB</span>
            <span>320×320</span>
            <span>~0.2 GB</span>
          </div>
        </div>
        {s.faq.bgNote}
      </section>

      <section className="faq-sec">
        <h3>{s.faq.upTitle}</h3>
        <p>{s.faq.upIntro}</p>
        {s.faq.upList}
      </section>

      <section className="faq-sec">
        <h3>{s.faq.locTitle}</h3>
        {s.faq.locBody}
      </section>

      <section className="faq-sec">
        <h3>{s.faq.compressTitle}</h3>
        <p>{s.faq.compressBody}</p>
      </section>

      <section className="faq-sec">
        <h3>{s.faq.dirTitle}</h3>
        <p className="faq-path">{dir || "…"}</p>
        {s.faq.dirNote}
      </section>
    </div>
  );
}

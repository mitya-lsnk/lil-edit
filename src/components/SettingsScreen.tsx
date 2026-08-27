import { useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { open } from "@tauri-apps/plugin-dialog";
import { AppearancePanel } from "./AppearancePanel";
import { Icon } from "./Icon";
import { ModelManager } from "./ModelManager";
import {
  cacheInfo,
  clearCache,
  modelsLocation,
  setModelsDir,
  type CacheInfo,
  type ModelsLocation,
} from "../lib/models";
import { formatBytes } from "../lib/format";
import { hasTauri } from "../lib/tauri";
import {
  autoCheckEnabled,
  safeReleaseUrl,
  setAutoCheck,
  type UpdateInfo,
} from "../lib/update";
import { useStrings } from "../lib/i18n";

interface SettingsProps {
  onOpenModels: () => void;
  /** Latest-release info from the startup check (null until it resolves). */
  update: UpdateInfo | null;
  checking: boolean;
  checkFailed: boolean;
  onCheck: () => void;
}

type Tab = "models" | "storage" | "look" | "about";

export function SettingsScreen({
  onOpenModels,
  update,
  checking,
  checkFailed,
  onCheck,
}: SettingsProps) {
  const str = useStrings();
  const [tab, setTab] = useState<Tab>("models");
  const [cache, setCache] = useState<CacheInfo | null>(null);
  const [clearing, setClearing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [loc, setLoc] = useState<ModelsLocation | null>(null);
  const [moveExisting, setMoveExisting] = useState(true);
  const [moving, setMoving] = useState(false);
  const [autoUpd, setAutoUpd] = useState(autoCheckEnabled);

  const tauri = hasTauri();

  function refreshCache() {
    if (!tauri) return;
    cacheInfo()
      .then(setCache)
      .catch(() => setCache(null));
    modelsLocation()
      .then(setLoc)
      .catch(() => setLoc(null));
  }
  useEffect(refreshCache, [tauri]);

  /** `dir: null` restores the default location. */
  async function relocate(dir: string | null) {
    setMoving(true);
    setNote(null);
    try {
      setLoc(await setModelsDir(dir, moveExisting));
      setNote(
        moveExisting ? str.settings.folderChangedMoved : str.settings.folderChanged,
      );
      refreshCache();
    } catch (e) {
      setNote(String(e));
    } finally {
      setMoving(false);
    }
  }

  async function onPickDir() {
    const dir = await open({ directory: true, multiple: false });
    if (typeof dir === "string") await relocate(dir);
  }

  async function onClear() {
    setClearing(true);
    setNote(null);
    try {
      const freed = await clearCache();
      setNote(str.settings.freed(formatBytes(freed)));
      setConfirm(false);
      refreshCache();
    } catch (e) {
      setNote(String(e));
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="settings">
      {/* Tabs rather than one page that scrolls past six sections. Order follows
          need: the models first, because without them two of the three tools do
          nothing, and appearance late, because it is a once-a-month decision.
          Same shape as lil view and lil download. */}
      <nav className="set-tabs">
        {(
          [
            ["models", str.settings.tabModels],
            ["storage", str.settings.tabStorage],
            ["look", str.settings.tabLook],
            ["about", str.settings.tabAbout],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            className={`b-btn ${tab === id ? "b-btn--solid" : ""}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* -------- Appearance -------- */}
      {tab === "look" && (
        <AppearancePanel
          name="lil edit"
          words={{
            primary: str.settings.pickFolder,
            secondary: str.settings.openFolder,
            accent: str.settings.clearCache,
            check: str.settings.moveExisting,
          }}
        />
      )}

      {/* -------- Cache -------- */}
      {tab === "storage" && (
      <section className="set-sec">
        <h3 className="set-h">{str.settings.storage}</h3>
        {!tauri ? (
          <p className="set-lead">{str.settings.cacheBrowserNote}</p>
        ) : (
          <>
            <div className="set-cache">
              <div className="set-stat">
                <span className="set-stat-num">
                  {cache ? formatBytes(cache.bytes) : "…"}
                </span>
                <span className="set-stat-lbl">{str.settings.onDisk}</span>
              </div>
              <div className="set-stat">
                <span className="set-stat-num">{cache ? cache.installed : "…"}</span>
                <span className="set-stat-lbl">{str.settings.modelsInstalled}</span>
              </div>
              <div className="set-cache-act">
                {confirm ? (
                  <>
                    <span className="set-warn-txt">{str.settings.deleteAll}</span>
                    <button
                      className="b-btn b-btn--solid"
                      disabled={clearing}
                      onClick={onClear}
                    >
                      {clearing ? str.settings.deleting : str.settings.yesClear}
                    </button>
                    <button
                      className="b-btn"
                      disabled={clearing}
                      onClick={() => setConfirm(false)}
                    >
                      {str.settings.cancel}
                    </button>
                  </>
                ) : (
                  <button
                    className="b-btn"
                    disabled={!cache || cache.bytes === 0}
                    onClick={() => setConfirm(true)}
                  >
                    {str.settings.clearCache}
                  </button>
                )}
              </div>
            </div>
            {note && <div className="set-note">{note}</div>}

            {/* Where the models live. People install the app on one drive and
                are (rightly) annoyed when gigabytes land on another. */}
            <div className="set-loc">
              <span className="set-loc-lbl">{str.settings.folder}</span>
              {loc && (
                <button
                  className="set-path"
                  onClick={() => openUrl(`file://${loc.dir}`)}
                  title={str.settings.openFolder}
                >
                  {loc.dir}
                </button>
              )}
              <label className="t-check">
                <input
                  type="checkbox"
                  checked={moveExisting}
                  disabled={moving}
                  onChange={(e) => setMoveExisting(e.target.checked)}
                />
                {str.settings.moveExisting}
              </label>
              <div className="set-loc-act">
                <button className="b-btn" disabled={moving} onClick={onPickDir}>
                  {moving ? str.settings.moving : str.settings.pickFolder}
                </button>
                {loc?.appDir && loc.dir !== loc.appDir && (
                  <button
                    className="b-btn"
                    disabled={moving}
                    onClick={() => relocate(loc.appDir)}
                    title={loc.appDir}
                  >
                    {str.settings.nearProgram}
                  </button>
                )}
                {loc?.custom && (
                  <button
                    className="b-btn"
                    disabled={moving}
                    onClick={() => relocate(null)}
                    title={loc.defaultDir}
                  >
                    {str.settings.default}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </section>
      )}

      {/* -------- Models -------- */}
      {tab === "models" && (
      <>
      <section className="set-sec">
        <h3 className="set-h">{str.settings.bgModels}</h3>
        {tauri ? (
          <ModelManager filter="background" onChanged={refreshCache} />
        ) : (
          <p className="set-lead">{str.settings.inApp}</p>
        )}
      </section>

      <section className="set-sec">
        <h3 className="set-h">{str.settings.upscaleEngines}</h3>
        {tauri ? (
          <ModelManager filter="upscale" onChanged={refreshCache} />
        ) : (
          <p className="set-lead">{str.settings.inApp}</p>
        )}
      </section>

      {/* -------- Models info (was the header "Models" button) -------- */}
      <section className="set-sec">
        <button className="b-btn" onClick={onOpenModels}>
          <Icon name="info" size={14} /> {str.settings.modelsFaq}
        </button>
      </section>
      </>
      )}

      {/* -------- About -------- */}
      {tab === "about" && (
      <section className="set-sec">
        <h3 className="set-h">{str.settings.aboutTitle}</h3>
        {str.settings.about}
        <p className="set-version">
          {str.settings.version} {__APP_VERSION__}
        </p>

        {tauri && (
          <div className="set-update">
            <label className="t-check">
              <input
                type="checkbox"
                checked={autoUpd}
                onChange={(e) => {
                  setAutoUpd(e.target.checked);
                  setAutoCheck(e.target.checked);
                }}
              />
              {str.settings.update.auto}
            </label>
            <p className="set-lead">{str.settings.update.autoNote}</p>

            <button className="b-btn" onClick={onCheck} disabled={checking}>
              {checking ? str.settings.update.checking : str.settings.update.check}
            </button>

            {!checking && checkFailed && (
              <span className="set-update-msg">{str.settings.update.failed}</span>
            )}
            {!checking && !checkFailed && update && !update.available && (
              <span className="set-update-msg">{str.settings.update.upToDate}</span>
            )}

            {!checking && update?.available && (
              <div className="set-update-card">
                <div className="set-update-head">
                  <span className="b-badge">{str.settings.update.available(update.latest)}</span>
                </div>
                {update.notes && (
                  <details className="set-update-notes">
                    <summary>{str.settings.update.whatsNew}</summary>
                    <pre>{update.notes}</pre>
                  </details>
                )}
                {/* Both URLs come from the GitHub API, so they're validated
                    before being handed to the OS opener. */}
                <div className="set-update-actions">
                  {(() => {
                    const dl =
                      safeReleaseUrl(update.asset) ?? safeReleaseUrl(update.url);
                    const page = safeReleaseUrl(update.url);
                    return (
                      <>
                        {dl && (
                          <button
                            className="b-btn b-btn--yellow"
                            onClick={() => openUrl(dl)}
                          >
                            {str.settings.update.download}
                          </button>
                        )}
                        {page && (
                          <button className="b-link" onClick={() => openUrl(page)}>
                            {str.settings.update.releasePage}
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
      )}
    </div>
  );
}

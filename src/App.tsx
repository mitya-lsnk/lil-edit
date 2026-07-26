import { useCallback, useEffect, useRef, useState } from "react";
import "./screens.css";
import "./skins.css";
import "./dark.css";
import { HomeBody, type Tool } from "./components/HomeScreen";
import { CompressPanel } from "./components/CompressPanel";
import { BackgroundPanel } from "./components/BackgroundPanel";
import { UpscalePanel } from "./components/UpscalePanel";
import { EditPanel } from "./components/EditPanel";
import { BatchPanel } from "./components/BatchPanel";
import { FaqScreen } from "./components/FaqScreen";
import { SettingsScreen } from "./components/SettingsScreen";
import { LanguagePicker } from "./components/LanguagePicker";
import { ModeToggle } from "./components/ModeToggle";
import { FileStrip } from "./components/FileStrip";
import { Toast } from "./components/Toast";
import { onImageDrop, pickImage, splitPath, type Picked } from "./lib/intake";
import { joinPath } from "./lib/save";
import { hasTauri } from "./lib/tauri";
import { checkUpdate, type UpdateInfo } from "./lib/update";
import { useStrings } from "./lib/i18n";

// The base screen is either home or a tool. Models/Settings/Batch are separate
// *overlays* (`aux`) drawn on top — so the tool underneath stays mounted and its
// result survives a trip into Settings.
type Base = "home" | Tool;
type Aux = "faq" | "settings" | "batch";

const TOOL_ORDER: Tool[] = ["upscale", "background", "edit", "compress"];

function App() {
  const s = useStrings();
  const [picked, setPicked] = useState<Picked | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [screen, setScreen] = useState<Base>("home");
  const [aux, setAux] = useState<Aux | null>(null);
  // The tool the user last worked in. Kept so its panel stays mounted even after
  // a slip back to Home — they can resume with "Продолжить" instead of redoing it.
  const [lastTool, setLastTool] = useState<Tool | null>(null);

  // Update check (lightweight: compare to the latest GitHub release, offer a
  // download — nothing installs itself). Runs once quietly at startup and again
  // on demand from Settings.
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkFailed, setCheckFailed] = useState(false);
  const runCheck = useCallback(async () => {
    setChecking(true);
    setCheckFailed(false);
    try {
      setUpdate(await checkUpdate());
    } catch {
      setCheckFailed(true);
    } finally {
      setChecking(false);
    }
  }, []);
  useEffect(() => {
    if (hasTauri()) void runCheck();
  }, [runCheck]);

  const mainRef = useRef<HTMLElement>(null);
  const file = picked?.file ?? null;
  // Folder of the original — the Save dialogs open there.
  const srcDir = picked?.path ? splitPath(picked.path).dir : null;

  // Browser fallback for Replace (no native dialog outside the app).
  const inputRef = useRef<HTMLInputElement>(null);

  // The whole window is the drop target and it accepts the file silently — no
  // overlay.
  useEffect(
    () =>
      onImageDrop((p) => {
        setDropError(null);
        setPicked(p);
      }, setDropError),
    [],
  );

  // Land at the top when the screen or overlay changes — otherwise opening the
  // (short) FAQ from a scrolled-down Settings leaves you stuck at the bottom.
  useEffect(() => {
    mainRef.current?.scrollTo?.({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [aux, screen]);

  // Swap the current image from inside a tool. Native picker in the app (so we
  // learn the path), hidden file input in the browser.
  async function replace() {
    if (!hasTauri()) {
      inputRef.current?.click();
      return;
    }
    const p = await pickImage(s.intake.imagesFilter);
    if (p) {
      setDropError(null);
      setPicked(p);
    }
  }

  function onInputFiles(files: FileList | null) {
    const img = Array.from(files ?? []).find((f) => f.type.startsWith("image/"));
    if (img) {
      setDropError(null);
      setPicked({ file: img, path: null });
    }
  }

  // Hand a tool's result to another tool as its next input, no save round-trip.
  // The result has no real path, but it logically belongs in the original's
  // folder — synthesize a path there so Save still defaults next to the source.
  // Go to a tool, remembering it so Home can offer to resume.
  function goTool(tool: Tool) {
    setScreen(tool);
    setLastTool(tool);
    setAux(null);
  }

  function sendTo(next: File, tool: Tool) {
    const path = srcDir ? joinPath(srcDir, next.name) : null;
    setDropError(null);
    setPicked({ file: next, path });
    goTool(tool);
  }

  // Wipe the working image and every derived result — a clean slate for the
  // next job. Offered from the post-save toast.
  function clearWorkspace() {
    setSavedPath(null);
    setPicked(null);
    setScreen("home");
    setAux(null);
    setLastTool(null);
  }

  const isHome = screen === "home";
  const onTool = screen !== "home";
  // Which tool's panel to keep mounted: the open one, or (on Home) the last one.
  const tool: Tool | null = onTool ? (screen as Tool) : lastTool;
  const auxTitle =
    aux === "faq"
      ? s.app.modelsTitle
      : aux === "settings"
        ? s.app.settingsTitle
        : aux === "batch"
          ? s.batch.title
          : "";

  // Overlays toggle on their own trigger (so a second click closes them) and
  // never touch `screen`, so the tool underneath keeps its state.
  const toggleAux = (target: Aux) =>
    setAux((cur) => (cur === target ? null : target));
  const openBatch = () => setAux("batch");
  const goHome = () => {
    setScreen("home");
    setAux(null);
  };
  // Back: close an open overlay first (revealing the tool), else go home.
  const goBack = () => (aux ? setAux(null) : setScreen("home"));

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="head-left">
          {/* The logo is the way home — no separate back/menu button. */}
          <button className="logo-btn" onClick={goHome} aria-label="lil image — home">
            <span className="logo">LIL IMAGE</span>
          </button>
          {/* Explicit way back — closes an overlay, else goes home. */}
          {(aux || onTool) && (
            <button className="back" onClick={goBack}>
              ← {s.app.back}
            </button>
          )}
          {aux && <span className="title-mid">{auxTitle}</span>}
          {!aux && onTool && (
            /* Jump straight between tools without a round-trip home —
               the loaded file carries over. */
            <div className="tool-switch" role="tablist">
              {TOOL_ORDER.map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={screen === t}
                  className={screen === t ? "active" : ""}
                  disabled={!file}
                  onClick={() => goTool(t)}
                >
                  {s.tools[t]}
                </button>
              ))}
            </div>
          )}
        </div>

        <span className="head-spacer" />

        {/* Persistent right cluster — theme, language, settings. Batch now lives
            on Home and next to the loaded file; skins/models live in Settings. */}
        <div className="head-right">
          <ModeToggle />
          <LanguagePicker />
          <button
            className={`help help-icon ${aux === "settings" ? "active" : ""}`}
            aria-pressed={aux === "settings"}
            onClick={() => toggleAux("settings")}
            aria-label={s.app.settingsAria}
            title={s.app.settingsAria}
          >
            ⚙
            {update?.available && (
              <span className="update-dot" aria-label={s.settings.update.badgeAria} />
            )}
          </button>
        </div>
      </header>

      <main className="app-body" ref={mainRef}>
        {/* Home — only when no overlay is up. */}
        {isHome && !aux && (
          <>
            {dropError && <div className="b-error">{dropError}</div>}
            <HomeBody
              file={file}
              onFile={setPicked}
              onPick={goTool}
              onBatch={openBatch}
              onContinue={lastTool ? () => setScreen(lastTool) : undefined}
            />
          </>
        )}

        {/* Tool host — stays mounted (just hidden) while an overlay is open or the
            user slips back Home, so an upscale/cut-out result is never lost. */}
        {tool && file && (
          <div className="tool-host" hidden={!!aux || isHome}>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => onInputFiles(e.target.files)}
            />
            <FileStrip file={file} onReplace={replace} onBatch={openBatch} />
            {tool === "edit" && (
              <EditPanel
                file={file}
                srcDir={srcDir}
                onSendTo={sendTo}
                onSaved={setSavedPath}
              />
            )}
            {tool === "compress" && (
              <CompressPanel
                file={file}
                srcDir={srcDir}
                onSendTo={sendTo}
                onSaved={setSavedPath}
              />
            )}
            {tool === "upscale" && (
              <UpscalePanel
                file={file}
                srcDir={srcDir}
                onSendTo={sendTo}
                onSaved={setSavedPath}
              />
            )}
            {tool === "background" && (
              <BackgroundPanel
                file={file}
                srcDir={srcDir}
                onSendTo={sendTo}
                onSaved={setSavedPath}
              />
            )}
          </div>
        )}

        {/* Overlays (rendered over the hidden tool host). */}
        {aux === "faq" && <FaqScreen />}
        {aux === "settings" && (
          <SettingsScreen
            onOpenModels={() => setAux("faq")}
            update={update}
            checking={checking}
            checkFailed={checkFailed}
            onCheck={runCheck}
          />
        )}
        {aux === "batch" && <BatchPanel />}
      </main>

      {savedPath && (
        <Toast
          path={savedPath}
          onClear={clearWorkspace}
          onClose={() => setSavedPath(null)}
        />
      )}
    </div>
  );
}

export default App;

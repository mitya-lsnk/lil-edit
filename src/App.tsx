import { useEffect, useRef, useState } from "react";
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
import { SkinPicker } from "./components/SkinPicker";
import { ModeToggle } from "./components/ModeToggle";
import { LanguagePicker } from "./components/LanguagePicker";
import { FileStrip } from "./components/FileStrip";
import { Toast } from "./components/Toast";
import { onImageDrop, pickImage, splitPath, type Picked } from "./lib/intake";
import { joinPath } from "./lib/save";
import { hasTauri } from "./lib/tauri";
import { useStrings } from "./lib/i18n";

type Screen = "home" | "faq" | "settings" | "batch" | Tool;

const TOOL_ORDER: Tool[] = ["upscale", "background", "edit", "compress"];

function App() {
  const s = useStrings();
  const [picked, setPicked] = useState<Picked | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>("home");

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
  function sendTo(next: File, tool: Tool) {
    const path = srcDir ? joinPath(srcDir, next.name) : null;
    setDropError(null);
    setPicked({ file: next, path });
    setScreen(tool);
  }

  // Wipe the working image and every derived result — a clean slate for the
  // next job. Offered from the post-save toast.
  function clearWorkspace() {
    setSavedPath(null);
    setPicked(null);
    setScreen("home");
  }

  const isHome = screen === "home";
  const isFaq = screen === "faq";
  const isSettings = screen === "settings";
  const isBatch = screen === "batch";
  const isAux = isHome || isFaq || isSettings || isBatch;
  const auxTitle = isFaq
    ? s.app.modelsTitle
    : isSettings
      ? s.app.settingsTitle
      : isBatch
        ? s.batch.title
        : "";

  // Models/Settings/Batch are reachable from anywhere. The header button
  // toggles: on the screen already → back home, otherwise open it (so it
  // doubles as its own "back" when you can't spot the logo). The logo also
  // always goes home.
  const toggleAux = (target: "faq" | "settings" | "batch") =>
    setScreen((cur) => (cur === target ? "home" : target));

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="head-left">
          {/* The logo is the way home — no separate back/menu button. */}
          <button
            className="logo-btn"
            onClick={() => setScreen("home")}
            aria-label="lil image — home"
          >
            <span className="logo">LIL IMAGE</span>
          </button>
          {/* Explicit way home — the logo works too, but not everyone knows that. */}
          {!isHome && (
            <button className="back" onClick={() => setScreen("home")}>
              ← {s.app.back}
            </button>
          )}
          {isHome && <span className="logo-sub">Image Toolkit</span>}
          {(isFaq || isSettings || isBatch) && (
            <span className="title-mid">{auxTitle}</span>
          )}
          {!isAux && (
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
                  onClick={() => setScreen(t)}
                >
                  {s.tools[t]}
                </button>
              ))}
            </div>
          )}
        </div>

        <span className="head-spacer" />

        {/* Persistent right cluster — available on every screen. */}
        <div className="head-right">
          <LanguagePicker />
          <SkinPicker />
          <ModeToggle />
          <button
            className={`help ${isBatch ? "active" : ""}`}
            aria-pressed={isBatch}
            onClick={() => toggleAux("batch")}
          >
            ▦ {s.batch.tab}
          </button>
          <button
            className={`help ${isFaq ? "active" : ""}`}
            aria-pressed={isFaq}
            onClick={() => toggleAux("faq")}
          >
            ? {s.app.helpModels}
          </button>
          <button
            className={`help ${isSettings ? "active" : ""}`}
            aria-pressed={isSettings}
            onClick={() => toggleAux("settings")}
            aria-label={s.app.settingsAria}
          >
            ⚙ {s.app.helpSettings}
          </button>
        </div>
      </header>

      <main className="app-body">
        {isFaq ? (
          <FaqScreen />
        ) : isSettings ? (
          <SettingsScreen />
        ) : isBatch ? (
          <BatchPanel />
        ) : isHome ? (
          <>
            {dropError && <div className="b-error">{dropError}</div>}
            <HomeBody
              file={file}
              onFile={setPicked}
              onPick={(tool) => setScreen(tool)}
            />
          </>
        ) : file ? (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => onInputFiles(e.target.files)}
            />
            <FileStrip file={file} onReplace={replace} />
            {screen === "edit" && (
              <EditPanel
                file={file}
                srcDir={srcDir}
                onSendTo={sendTo}
                onSaved={setSavedPath}
              />
            )}
            {screen === "compress" && (
              <CompressPanel
                file={file}
                srcDir={srcDir}
                onSendTo={sendTo}
                onSaved={setSavedPath}
              />
            )}
            {screen === "upscale" && (
              <UpscalePanel
                file={file}
                srcDir={srcDir}
                onSendTo={sendTo}
                onSaved={setSavedPath}
              />
            )}
            {screen === "background" && (
              <BackgroundPanel
                file={file}
                srcDir={srcDir}
                onSendTo={sendTo}
                onSaved={setSavedPath}
              />
            )}
          </>
        ) : (
          <div className="home-drop" style={{ marginBottom: 0 }}>
            <div className="plus" />
            <div className="dz-title">{s.app.dropTitle}</div>
            <div className="dz-sub">{s.app.dropSub}</div>
          </div>
        )}
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

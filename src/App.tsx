import { useEffect, useState } from "react";
import "./screens.css";
import "./skins.css";
import "./dark.css";
import { HomeBody, type Tool } from "./components/HomeScreen";
import { CompressPanel } from "./components/CompressPanel";
import { BackgroundPanel } from "./components/BackgroundPanel";
import { UpscalePanel } from "./components/UpscalePanel";
import { FaqScreen } from "./components/FaqScreen";
import { SettingsScreen } from "./components/SettingsScreen";
import { SkinPicker } from "./components/SkinPicker";
import { ModeToggle } from "./components/ModeToggle";
import { onImageDrop, splitPath, type Picked } from "./lib/intake";

type Screen = "home" | "faq" | "settings" | Tool;

const TOOL_META: Record<Tool, { title: string; step: string; short: string }> = {
  compress: { title: "COMPRESS", step: "01 / 03", short: "Сжатие" },
  upscale: { title: "UPSCALE", step: "02 / 03", short: "Апскейл" },
  background: { title: "REMOVE BG", step: "03 / 03", short: "Фон" },
};

const TOOL_ORDER: Tool[] = ["compress", "upscale", "background"];

function App() {
  const [picked, setPicked] = useState<Picked | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>("home");
  // Where "back" from Models/Settings should land (the screen you opened them from).
  const [returnTo, setReturnTo] = useState<Screen>("home");

  const file = picked?.file ?? null;
  // Folder of the original — the Save dialogs open there.
  const srcDir = picked?.path ? splitPath(picked.path).dir : null;

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

  const isHome = screen === "home";
  const isFaq = screen === "faq";
  const isSettings = screen === "settings";
  const isAux = isHome || isFaq || isSettings;
  const auxTitle = isFaq ? "МОДЕЛИ" : isSettings ? "НАСТРОЙКИ" : "";

  // Models/Settings are reachable from anywhere; remember where we came from so
  // "back" returns there instead of always dumping the user on the home screen.
  function openAux(target: "faq" | "settings") {
    if (!isFaq && !isSettings) setReturnTo(screen);
    setScreen(target);
  }
  const goBack = () => setScreen(isAux ? returnTo : "home");

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="head-left">
          {isHome ? (
            <>
              <span className="logo">LIL IMAGE</span>
              <span className="logo-sub">Image Toolkit</span>
            </>
          ) : (
            <>
              <button className="back" onClick={goBack}>
                ← {isAux ? "Назад" : "Меню"}
              </button>
              {isAux ? (
                <span className="title-mid">{auxTitle}</span>
              ) : (
                /* Jump straight between tools without a round-trip to the menu —
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
                      {TOOL_META[t].short}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <span className="head-spacer" />

        {/* Persistent right cluster — available on every screen. */}
        <div className="head-right">
          <SkinPicker />
          <ModeToggle />
          <button
            className={`help ${isFaq ? "active" : ""}`}
            onClick={() => openAux("faq")}
          >
            ? Модели
          </button>
          <button
            className={`help ${isSettings ? "active" : ""}`}
            onClick={() => openAux("settings")}
            aria-label="Настройки"
          >
            ⚙ Настройки
          </button>
        </div>
      </header>

      <main className="app-body">
        {isFaq ? (
          <FaqScreen />
        ) : isSettings ? (
          <SettingsScreen />
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
            {screen === "compress" && (
              <CompressPanel file={file} srcDir={srcDir} />
            )}
            {screen === "upscale" && <UpscalePanel file={file} srcDir={srcDir} />}
            {screen === "background" && (
              <BackgroundPanel file={file} srcDir={srcDir} />
            )}
          </>
        ) : (
          <div className="home-drop" style={{ marginBottom: 0 }}>
            <div className="plus" />
            <div className="dz-title">Перетащите изображение сюда</div>
            <div className="dz-sub">бросьте файл в любое место окна</div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;

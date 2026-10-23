import React from "react";
import ReactDOM from "react-dom/client";
import "./theme.css";
// Shared settings styles (lil-kit). Imported before App so screens.css still
// lands after it; skins.css and dark.css don't touch these selectors.
import "./lil-settings.css";
import { SkinProvider } from "./lib/skin";
import { LangProvider } from "./lib/i18n";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <LangProvider>
      <SkinProvider>
        <App />
      </SkinProvider>
    </LangProvider>
  </React.StrictMode>,
);

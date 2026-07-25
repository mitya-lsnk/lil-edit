import React from "react";
import ReactDOM from "react-dom/client";
import "./theme.css";
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

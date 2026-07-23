import React from "react";
import ReactDOM from "react-dom/client";
import "./theme.css";
import { SkinProvider } from "./lib/skin";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <SkinProvider>
      <App />
    </SkinProvider>
  </React.StrictMode>,
);

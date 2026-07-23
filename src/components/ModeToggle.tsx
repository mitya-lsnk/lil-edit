import { useSkin } from "../lib/skin";

/** Sun/moon switch for the header — flips the light/dark axis. */
export function ModeToggle() {
  const { mode, toggleMode } = useSkin();
  const dark = mode === "dark";
  return (
    <button
      className="mode-toggle"
      onClick={toggleMode}
      title={dark ? "Светлая тема" : "Тёмная тема"}
      aria-label={dark ? "Включить светлую тему" : "Включить тёмную тему"}
      aria-pressed={dark}
    >
      {dark ? "☾" : "☀"}
    </button>
  );
}

import { SKINS, useSkin } from "../lib/skin";

/** Compact swatch row for the header. */
export function SkinPicker() {
  const { skin, setSkin } = useSkin();
  return (
    <div className="skin-pick" role="group" aria-label="Оформление">
      {SKINS.map((s) => (
        <button
          key={s.id}
          className={`skin-chip ${skin === s.id ? "active" : ""}`}
          onClick={() => setSkin(s.id)}
          title={`${s.name} — ${s.tagline}`}
          aria-pressed={skin === s.id}
        >
          <span
            className="skin-sw"
            style={{
              background: `linear-gradient(135deg, ${s.swatch[0]} 0 50%, ${s.swatch[1]} 50% 100%)`,
            }}
          />
        </button>
      ))}
    </div>
  );
}

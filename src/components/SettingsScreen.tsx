import { useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { SKINS, useSkin } from "../lib/skin";
import { ModelManager } from "./ModelManager";
import { cacheInfo, clearCache, type CacheInfo } from "../lib/models";
import { formatBytes } from "../lib/format";
import { hasTauri } from "../lib/tauri";

export function SettingsScreen() {
  const { skin, setSkin } = useSkin();
  const [cache, setCache] = useState<CacheInfo | null>(null);
  const [clearing, setClearing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const tauri = hasTauri();

  function refreshCache() {
    if (!tauri) return;
    cacheInfo()
      .then(setCache)
      .catch(() => setCache(null));
  }
  useEffect(refreshCache, [tauri]);

  async function onClear() {
    setClearing(true);
    setNote(null);
    try {
      const freed = await clearCache();
      setNote(`Освобождено ${formatBytes(freed)}.`);
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
      {/* -------- Appearance -------- */}
      <section className="set-sec">
        <h3 className="set-h">Оформление</h3>
        <p className="set-lead">
          Скин меняет весь интерфейс — цвета, шрифты, формы и анимации. Выбор
          запоминается.
        </p>
        <div className="skin-grid">
          {SKINS.map((s) => (
            <button
              key={s.id}
              className={`skin-card ${skin === s.id ? "active" : ""}`}
              onClick={() => setSkin(s.id)}
            >
              <span
                className="skin-card-sw"
                style={{
                  background: `linear-gradient(135deg, ${s.swatch[0]} 0 50%, ${s.swatch[1]} 50% 100%)`,
                }}
              />
              <span className="skin-card-name">{s.name}</span>
              <span className="skin-card-tag">{s.tagline}</span>
              {skin === s.id && <span className="skin-card-on">✓ выбран</span>}
            </button>
          ))}
        </div>
      </section>

      {/* -------- Cache -------- */}
      <section className="set-sec">
        <h3 className="set-h">Хранилище моделей</h3>
        {!tauri ? (
          <p className="set-lead">
            Управление кешем доступно в приложении (не в браузере).
          </p>
        ) : (
          <>
            <div className="set-cache">
              <div className="set-stat">
                <span className="set-stat-num">
                  {cache ? formatBytes(cache.bytes) : "…"}
                </span>
                <span className="set-stat-lbl">на диске</span>
              </div>
              <div className="set-stat">
                <span className="set-stat-num">{cache ? cache.installed : "…"}</span>
                <span className="set-stat-lbl">моделей установлено</span>
              </div>
              <div className="set-cache-act">
                {confirm ? (
                  <>
                    <span className="set-warn-txt">Удалить все модели?</span>
                    <button
                      className="b-btn b-btn--solid"
                      disabled={clearing}
                      onClick={onClear}
                    >
                      {clearing ? "Удаляю…" : "Да, очистить"}
                    </button>
                    <button
                      className="b-btn"
                      disabled={clearing}
                      onClick={() => setConfirm(false)}
                    >
                      Отмена
                    </button>
                  </>
                ) : (
                  <button
                    className="b-btn"
                    disabled={!cache || cache.bytes === 0}
                    onClick={() => setConfirm(true)}
                  >
                    Очистить кеш
                  </button>
                )}
              </div>
            </div>
            {note && <div className="set-note">{note}</div>}
            {cache && (
              <button
                className="set-path"
                onClick={() => openUrl(`file://${cache.dir}`)}
                title="Открыть в Finder"
              >
                {cache.dir}
              </button>
            )}
          </>
        )}
      </section>

      {/* -------- Models -------- */}
      <section className="set-sec">
        <h3 className="set-h">Модели удаления фона</h3>
        {tauri ? (
          <ModelManager filter="background" onChanged={refreshCache} />
        ) : (
          <p className="set-lead">Доступно в приложении.</p>
        )}
      </section>

      <section className="set-sec">
        <h3 className="set-h">Движок апскейла</h3>
        {tauri ? (
          <ModelManager filter="upscale" onChanged={refreshCache} />
        ) : (
          <p className="set-lead">Доступно в приложении.</p>
        )}
      </section>

      {/* -------- About -------- */}
      <section className="set-sec">
        <h3 className="set-h">О программе</h3>
        <p className="set-lead">
          <b>lil image</b> — локальный набор инструментов для изображений:
          сжатие, апскейл и удаление фона. Всё считается на вашем компьютере,
          без отправки в сеть.
        </p>
      </section>
    </div>
  );
}

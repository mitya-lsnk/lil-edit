import { useEffect, useState } from "react";
import { modelsDirPath } from "../lib/models";
import { hasTauri } from "../lib/tauri";

/**
 * Straight answers about what the app actually loads. Everything here is meant
 * to match the registry in src-tauri/src/models.rs — if a model is added there,
 * add it here too.
 */
export function FaqScreen() {
  const [dir, setDir] = useState<string>("");
  useEffect(() => {
    if (!hasTauri()) return;
    modelsDirPath()
      .then(setDir)
      .catch(() => setDir(""));
  }, []);

  return (
    <div className="faq">
      <h2 className="faq-h">Какие модели читает программа</h2>
      <p className="faq-lead">
        Программа не сканирует произвольные файлы: она работает со своим списком
        моделей и скачивает их сама. Всё считается локально, без интернета —
        сеть нужна только в момент загрузки модели.
      </p>

      <section className="faq-sec">
        <h3>Удаление фона — формат ONNX</h3>
        <div className="faq-table">
          <div className="faq-row faq-head">
            <span>Модель</span>
            <span>Вес</span>
            <span>Вход</span>
            <span>Память</span>
          </div>
          <div className="faq-row">
            <span>
              <b>BiRefNet</b>
              <em>лучшее качество, края волос и меха</em>
            </span>
            <span>928 МБ</span>
            <span>1024×1024</span>
            <span className="warn">~8 ГБ</span>
          </div>
          <div className="faq-row">
            <span>
              <b>IS-Net (general)</b>
              <em>резкие края, хорош для портретов</em>
            </span>
            <span>170 МБ</span>
            <span>1024×1024</span>
            <span>~1 ГБ</span>
          </div>
          <div className="faq-row">
            <span>
              <b>U²-Net (full)</b>
              <em>универсальная, крепкий баланс</em>
            </span>
            <span>168 МБ</span>
            <span>320×320</span>
            <span>~0.5 ГБ</span>
          </div>
          <div className="faq-row">
            <span>
              <b>Silueta</b>
              <em>U²-Net, ужатая до 42 МБ</em>
            </span>
            <span>42 МБ</span>
            <span>320×320</span>
            <span>~0.3 ГБ</span>
          </div>
          <div className="faq-row">
            <span>
              <b>U²-Net (lite)</b>
              <em>самая быстрая, для проб</em>
            </span>
            <span>4.4 МБ</span>
            <span>320×320</span>
            <span>~0.2 ГБ</span>
          </div>
        </div>
        <p className="faq-note">
          <b>Почему BiRefNet столько ест.</b> У этого экспорта вход жёстко зашит
          как 1024×1024, и уменьшить его нельзя — модель просто откажется
          считать. Восемь гигабайт уходят не на сам файл, а на промежуточные
          вычисления трансформера в этом разрешении. Если памяти мало — берите
          IS-Net: качество близкое, а расход в разы меньше.
        </p>
      </section>

      <section className="faq-sec">
        <h3>Апскейл — движок Real-ESRGAN (ncnn)</h3>
        <p>
          Это не отдельные файлы моделей, а один бандл на 49 МБ: бинарник плюс
          веса. Считает на видеокарте через Vulkan. Внутри три варианта:
        </p>
        <ul className="faq-list">
          <li>
            <b>General (x4plus)</b> — фотографии и всё подряд
          </li>
          <li>
            <b>Anime (x4plus-anime)</b> — рисовка, чистые линии
          </li>
          <li>
            <b>Anime video (v3)</b> — кадры из аниме, отдельные веса на ×2/×3/×4
          </li>
        </ul>
      </section>

      <section className="faq-sec">
        <h3>Сжатие — без моделей</h3>
        <p>
          Сжатие никаких моделей не требует и работает сразу: кодеки MozJPEG,
          WebP, AVIF и OxiPNG собраны в саму программу.
        </p>
      </section>

      <section className="faq-sec">
        <h3>Где лежат скачанные модели</h3>
        <p className="faq-path">{dir || "…"}</p>
        <p className="faq-note">
          Папку можно удалить целиком — программа не сломается, просто предложит
          скачать модели заново. Свои <code>.onnx</code> положить туда пока
          нельзя: читаются только модели из списка выше.
        </p>
      </section>
    </div>
  );
}

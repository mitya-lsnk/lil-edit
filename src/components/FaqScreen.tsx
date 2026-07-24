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
        <h3>Апскейл — три движка на выбор</h3>
        <p>
          Это не отдельные файлы моделей, а бандл: бинарник плюс веса. Считает на
          видеокарте через Vulkan. Ставить все три не нужно — берите один.
        </p>
        <ul className="faq-list">
          <li>
            <b>Upscayl (ncnn)</b> — сборка декабря 2025, живой форк Real-ESRGAN.
            Пять моделей: <b>Стандарт</b> (универсальная), <b>Remacri</b> и{" "}
            <b>UltraSharp</b> (фото — вторая злее по резкости),{" "}
            <b>Digital&nbsp;Art</b> (рисунки и рендеры), <b>Lite</b> (быстрая).
            Начинать стоит отсюда.
          </li>
          <li>
            <b>Real-ESRGAN (ncnn)</b> — оригинал 2022 года: General&nbsp;(x4plus),
            Anime&nbsp;(x4plus-anime), Anime&nbsp;video&nbsp;(v3, отдельные веса
            на ×2/×3/×4). Запасной вариант, если Upscayl не поладил с
            видеокартой.
          </li>
          <li>
            <b>waifu2x (ncnn)</b> — сборка сентября 2025. Работает иначе:
            не «дорисовывает» детали, а чистит и увеличивает, с отдельной ручкой
            шумодава (0…3). Лучший выбор для аниме, лайн-арта и сканов — там, где
            Real-ESRGAN норовит превратить линии в пластик.
          </li>
        </ul>
      </section>

      <section className="faq-sec">
        <h3>Где лежат модели</h3>
        <p>
          По умолчанию — в системной папке приложения, и это часто диск C:. Если
          места там мало, откройте <b>Настройки → Хранилище моделей</b> и
          выберите любую другую папку (хоть рядом с самой программой). Уже
          скачанное можно перенести туда же, галочкой.
        </p>
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

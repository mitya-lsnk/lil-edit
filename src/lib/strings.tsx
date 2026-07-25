// All user-facing text, in Russian and English. The Russian object is the
// source of truth for the shape; `en` is typed as `Dict = typeof ru`, so the
// compiler flags any key the two languages disagree on.
//
// Prose-heavy bits (FAQ, onboarding, the "browser only" notices) are rendered
// as JSX here rather than reassembled in the components — one place per string,
// even when the string has emphasis or line breaks in it.

import type { ReactNode } from "react";

const ru = {
  app: {
    tagline: "Image Toolkit",
    back: "Назад",
    menu: "Меню",
    modelsTitle: "МОДЕЛИ",
    settingsTitle: "НАСТРОЙКИ",
    helpModels: "Модели",
    helpSettings: "Настройки",
    settingsAria: "Настройки",
    dropTitle: "Перетащите изображение сюда",
    dropSub: "бросьте файл в любое место окна",
  },
  tools: {
    compress: "Сжатие",
    upscale: "Апскейл",
    background: "Фон",
    edit: "Правка",
  },
  home: {
    loaded: "Изображение загружено",
    replace: "Заменить",
    toolHead: "Что сделаем?",
    dropSubClick: (
      <>
        бросьте файл в любое место окна или <u>нажмите, чтобы выбрать</u>
      </>
    ),
    cards: {
      compress: "Сжать файл без потери деталей.",
      upscale: "Увеличить и повысить резкость.",
      background: "Вырезать объект, убрать фон.",
      edit: "Кроп, поворот и размер.",
    },
  },
  edit: {
    crop: "Обрезка",
    ratio: "Пропорции",
    free: "Свободно",
    apply: "Применить",
    cancel: "Отмена",
    resize: "Размер",
    width: "Ш",
    height: "В",
    lock: "Сохранять пропорции",
    percent: "Процент",
    unitPx: "px",
    unitPct: "%",
    applyResize: "Изменить размер",
    rotateL: "Повернуть влево",
    rotateR: "Повернуть вправо",
    flipH: "Отразить по горизонтали",
    flipV: "Отразить по вертикали",
    undo: "Отменить",
    redo: "Вернуть",
    reset: "Сбросить",
    save: "Сохранить PNG ↓",
    saved: "Сохранено:",
  },
  compress: {
    format: "Формат",
    quality: "Качество",
    run: "Сжать →",
    running: "Сжимаю…",
    save: "Сохранить ↓",
    saved: "Сохранено:",
    original: "ОРИГИНАЛ",
  },
  upscale: {
    engine: "Движок",
    model: "Модель",
    scale: "Масштаб",
    denoise: "Шумодав",
    denoiseNone: "нет",
    run: "Увеличить →",
    running: "Апскейл…",
    busyNote: "Обработка может занять от секунд до минуты — зависит от размера и GPU.",
    save: "Сохранить PNG ↓",
    saved: "Сохранено:",
    original: "ОРИГИНАЛ",
    details: "Движки апскейла",
    onboardTitle: "Сначала — движок",
    onboard: (
      <p>
        Апскейл считается на <b>GPU через Vulkan</b> отдельной программой: её
        нужно <b>один раз скачать</b>, дальше всё локально и офлайн. Движков три —
        начните с <b>Upscayl</b>, он самый свежий и с лучшими моделями.
      </p>
    ),
    browser: (
      <p>
        <b>Апскейл работает в приложении lil image.</b> Ему нужен движок ncnn и
        GPU через Vulkan — в браузере их нет. Запусти{" "}
        <code>npm run tauri dev</code>.
      </p>
    ),
    modelLabels: {
      "upscayl-standard-4x": "Стандарт · универсальная",
      "remacri-4x": "Remacri · фото",
      "ultrasharp-4x": "UltraSharp · максимум резкости",
      "digital-art-4x": "Digital Art · рисунки, рендеры",
      "upscayl-lite-4x": "Lite · быстрая",
      "realesrgan-x4plus": "General (x4plus)",
      "realesrgan-x4plus-anime": "Anime (x4plus)",
      "realesr-animevideov3": "Anime video (v3)",
      "models-cunet": "CUNet · аниме, лучшее качество",
      "models-upconv_7_anime_style_art_rgb": "UpConv7 · аниме, быстрее",
      "models-upconv_7_photo": "UpConv7 · фото",
    } as Record<string, string>,
  },
  background: {
    model: "Модель",
    run: "Удалить фон →",
    running: "Обрабатываю…",
    save: "Сохранить PNG ↓",
    saved: "Сохранено:",
    original: "ОРИГИНАЛ",
    nobg: "БЕЗ ФОНА",
    details: "Модели фона",
    onboardTitle: "Выберите модель",
    onboard: (
      <p>
        Скачивается один раз, работает <b>локально и офлайн</b>. Топ качества —{" "}
        <b>BiRefNet</b>; для быстрой пробы хватит <b>U²-Net (lite)</b>.
      </p>
    ),
    browser: (
      <p>
        <b>Удаление фона работает в приложении lil image.</b> Ему нужен локальный
        AI-движок из Rust-бэкенда, которого нет в браузере. Запусти{" "}
        <code>npm run tauri dev</code> — там всё заработает.
      </p>
    ),
  },
  compare: {
    modeHold: "Результат",
    modeSplit: "Ползунок",
    modeSide: "Рядом",
    loupe: "🔍 Лупа",
    loupeTitle: "Лупа включается сама при наведении на изображение",
    matteLabel: "Фон:",
    matteAria: "Подложка",
    matteChecker: "Шахматная (прозрачность)",
    matteWhite: "Белая подложка",
    matteBlack: "Чёрная подложка",
    holdHint: "зажмите, чтобы сравнить",
    fullscreen: "⛶ Fullscreen",
    close: "× Закрыть",
    before: "ДО",
    after: "ПОСЛЕ",
  },
  models: {
    source: "источник ↗",
    delete: "Удалить",
    download: "Скачать ↓",
    installed: "УСТАНОВЛЕНО",
    extract: "распаковка…",
    done: "готово",
    dir: "Модели:",
  },
  settings: {
    appearance: "Оформление",
    appearanceLead:
      "Скин меняет весь интерфейс — цвета, шрифты, формы и анимации. Выбор запоминается.",
    chosen: "✓ выбран",
    storage: "Хранилище моделей",
    cacheBrowserNote: "Управление кешем доступно в приложении (не в браузере).",
    onDisk: "на диске",
    modelsInstalled: "моделей установлено",
    deleteAll: "Удалить все модели?",
    deleting: "Удаляю…",
    yesClear: "Да, очистить",
    cancel: "Отмена",
    clearCache: "Очистить кеш",
    freed: (size: string) => `Освобождено ${size}.`,
    folder: "Папка моделей",
    openFolder: "Открыть папку",
    moveExisting: "переносить уже скачанное",
    pickFolder: "Выбрать папку…",
    moving: "Переношу…",
    nearProgram: "Рядом с программой",
    default: "По умолчанию",
    folderChangedMoved: "Папка изменена, скачанное перенесено.",
    folderChanged: "Папка изменена.",
    bgModels: "Модели удаления фона",
    upscaleEngines: "Движки апскейла",
    inApp: "Доступно в приложении.",
    aboutTitle: "О программе",
    about: (
      <p className="set-lead">
        <b>lil image</b> — локальный набор инструментов для изображений: сжатие,
        апскейл и удаление фона. Всё считается на вашем компьютере, без отправки
        в сеть.
      </p>
    ),
  },
  skins: {
    brutal: { name: "Нео-брутализм", tagline: "жёсткие рамки, тени, жёлтый" },
    riso: { name: "Рисо-поп", tagline: "японский ризограф, полутон" },
    te: { name: "TE Hardware", tagline: "приборная панель, скругления" },
  },
  mode: {
    toLightTitle: "Светлая тема",
    toDarkTitle: "Тёмная тема",
    toLightAria: "Включить светлую тему",
    toDarkAria: "Включить тёмную тему",
  },
  intake: {
    imagesFilter: "Изображения",
  },
  pipe: {
    label: "Дальше:",
  },
  toast: {
    saved: "Сохранено",
    openFolder: "Открыть папку",
    clear: "Очистить и начать заново",
    close: "Закрыть",
  },
  lang: {
    label: "Язык",
    ru: "Русский",
    en: "English",
  },
  faq: {
    heading: "Какие модели читает программа",
    lead: "Программа не сканирует произвольные файлы: она работает со своим списком моделей и скачивает их сама. Всё считается локально, без интернета — сеть нужна только в момент загрузки модели.",
    bgTitle: "Удаление фона — формат ONNX",
    bgCols: { model: "Модель", weight: "Вес", input: "Вход", memory: "Память" },
    bgRows: {
      birefnet: "лучшее качество, края волос и меха",
      isnet: "резкие края, хорош для портретов",
      u2netFull: "универсальная, крепкий баланс",
      silueta: "U²-Net, ужатая до 42 МБ",
      u2netLite: "самая быстрая, для проб",
    },
    bgNote: (
      <p className="faq-note">
        <b>Почему BiRefNet столько ест.</b> У этого экспорта вход жёстко зашит
        как 1024×1024, и уменьшить его нельзя — модель просто откажется считать.
        Восемь гигабайт уходят не на сам файл, а на промежуточные вычисления
        трансформера в этом разрешении. Если памяти мало — берите IS-Net:
        качество близкое, а расход в разы меньше.
      </p>
    ),
    upTitle: "Апскейл — три движка на выбор",
    upIntro:
      "Это не отдельные файлы моделей, а бандл: бинарник плюс веса. Считает на видеокарте через Vulkan. Ставить все три не нужно — берите один.",
    upList: (
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
          Anime&nbsp;(x4plus-anime), Anime&nbsp;video&nbsp;(v3, отдельные веса на
          ×2/×3/×4). Запасной вариант, если Upscayl не поладил с видеокартой.
        </li>
        <li>
          <b>waifu2x (ncnn)</b> — сборка сентября 2025. Работает иначе: не
          «дорисовывает» детали, а чистит и увеличивает, с отдельной ручкой
          шумодава (0…3). Лучший выбор для аниме, лайн-арта и сканов — там, где
          Real-ESRGAN норовит превратить линии в пластик.
        </li>
      </ul>
    ),
    locTitle: "Где лежат модели",
    locBody: (
      <p>
        По умолчанию — в системной папке приложения, и это часто диск C:. Если
        места там мало, откройте <b>Настройки → Хранилище моделей</b> и выберите
        любую другую папку (хоть рядом с самой программой). Уже скачанное можно
        перенести туда же, галочкой.
      </p>
    ),
    compressTitle: "Сжатие — без моделей",
    compressBody:
      "Сжатие никаких моделей не требует и работает сразу: кодеки MozJPEG, WebP, AVIF и OxiPNG собраны в саму программу.",
    dirTitle: "Где лежат скачанные модели",
    dirNote: (
      <p className="faq-note">
        Папку можно удалить целиком — программа не сломается, просто предложит
        скачать модели заново. Свои <code>.onnx</code> положить туда пока нельзя:
        читаются только модели из списка выше.
      </p>
    ),
  },
} satisfies Record<string, unknown>;

export type Dict = typeof ru;

const en: Dict = {
  app: {
    tagline: "Image Toolkit",
    back: "Back",
    menu: "Menu",
    modelsTitle: "MODELS",
    settingsTitle: "SETTINGS",
    helpModels: "Models",
    helpSettings: "Settings",
    settingsAria: "Settings",
    dropTitle: "Drop an image here",
    dropSub: "drop a file anywhere in the window",
  },
  tools: {
    compress: "Compress",
    upscale: "Upscale",
    background: "Background",
    edit: "Edit",
  },
  home: {
    loaded: "Image loaded",
    replace: "Replace",
    toolHead: "What next?",
    dropSubClick: (
      <>
        drop a file anywhere in the window, or <u>click to choose</u>
      </>
    ),
    cards: {
      compress: "Shrink the file without losing detail.",
      upscale: "Enlarge and sharpen.",
      background: "Cut out the subject, drop the background.",
      edit: "Crop, rotate and resize.",
    },
  },
  edit: {
    crop: "Crop",
    ratio: "Aspect",
    free: "Free",
    apply: "Apply",
    cancel: "Cancel",
    resize: "Resize",
    width: "W",
    height: "H",
    lock: "Keep ratio",
    percent: "Percent",
    unitPx: "px",
    unitPct: "%",
    applyResize: "Resize",
    rotateL: "Rotate left",
    rotateR: "Rotate right",
    flipH: "Flip horizontal",
    flipV: "Flip vertical",
    undo: "Undo",
    redo: "Redo",
    reset: "Reset",
    save: "Save PNG ↓",
    saved: "Saved:",
  },
  compress: {
    format: "Format",
    quality: "Quality",
    run: "Compress →",
    running: "Compressing…",
    save: "Save ↓",
    saved: "Saved:",
    original: "ORIGINAL",
  },
  upscale: {
    engine: "Engine",
    model: "Model",
    scale: "Scale",
    denoise: "Denoise",
    denoiseNone: "off",
    run: "Upscale →",
    running: "Upscaling…",
    busyNote:
      "This can take from seconds to a minute — depends on the size and your GPU.",
    save: "Save PNG ↓",
    saved: "Saved:",
    original: "ORIGINAL",
    details: "Upscale engines",
    onboardTitle: "First — an engine",
    onboard: (
      <p>
        Upscaling runs on the <b>GPU via Vulkan</b> in a separate program: you{" "}
        <b>download it once</b>, then everything stays local and offline. There
        are three engines — start with <b>Upscayl</b>, the newest one with the
        best models.
      </p>
    ),
    browser: (
      <p>
        <b>Upscaling runs in the lil image app.</b> It needs the ncnn engine and
        a GPU through Vulkan — neither exists in the browser. Run{" "}
        <code>npm run tauri dev</code>.
      </p>
    ),
    modelLabels: {
      "upscayl-standard-4x": "Standard · all-purpose",
      "remacri-4x": "Remacri · photo",
      "ultrasharp-4x": "UltraSharp · maximum sharpness",
      "digital-art-4x": "Digital Art · illustration, renders",
      "upscayl-lite-4x": "Lite · fast",
      "realesrgan-x4plus": "General (x4plus)",
      "realesrgan-x4plus-anime": "Anime (x4plus)",
      "realesr-animevideov3": "Anime video (v3)",
      "models-cunet": "CUNet · anime, best quality",
      "models-upconv_7_anime_style_art_rgb": "UpConv7 · anime, faster",
      "models-upconv_7_photo": "UpConv7 · photo",
    },
  },
  background: {
    model: "Model",
    run: "Remove background →",
    running: "Processing…",
    save: "Save PNG ↓",
    saved: "Saved:",
    original: "ORIGINAL",
    nobg: "NO BG",
    details: "Background models",
    onboardTitle: "Pick a model",
    onboard: (
      <p>
        Downloaded once, runs <b>locally and offline</b>. Best quality is{" "}
        <b>BiRefNet</b>; for a quick try <b>U²-Net (lite)</b> is enough.
      </p>
    ),
    browser: (
      <p>
        <b>Background removal runs in the lil image app.</b> It needs the local
        AI engine in the Rust backend, which the browser doesn't have. Run{" "}
        <code>npm run tauri dev</code> and it'll work there.
      </p>
    ),
  },
  compare: {
    modeHold: "Result",
    modeSplit: "Slider",
    modeSide: "Side by side",
    loupe: "🔍 Loupe",
    loupeTitle: "The loupe turns on by itself when you hover the image",
    matteLabel: "Backdrop:",
    matteAria: "Backdrop",
    matteChecker: "Checkerboard (transparency)",
    matteWhite: "White backdrop",
    matteBlack: "Black backdrop",
    holdHint: "press and hold to compare",
    fullscreen: "⛶ Fullscreen",
    close: "× Close",
    before: "BEFORE",
    after: "AFTER",
  },
  models: {
    source: "source ↗",
    delete: "Remove",
    download: "Download ↓",
    installed: "INSTALLED",
    extract: "extracting…",
    done: "done",
    dir: "Models:",
  },
  settings: {
    appearance: "Appearance",
    appearanceLead:
      "A skin changes the whole interface — colors, fonts, shapes and animations. Your choice is remembered.",
    chosen: "✓ selected",
    storage: "Model storage",
    cacheBrowserNote: "Cache management is available in the app (not the browser).",
    onDisk: "on disk",
    modelsInstalled: "models installed",
    deleteAll: "Delete all models?",
    deleting: "Deleting…",
    yesClear: "Yes, clear",
    cancel: "Cancel",
    clearCache: "Clear cache",
    freed: (size: string) => `Freed ${size}.`,
    folder: "Models folder",
    openFolder: "Open folder",
    moveExisting: "move what's already downloaded",
    pickFolder: "Choose folder…",
    moving: "Moving…",
    nearProgram: "Next to the program",
    default: "Default",
    folderChangedMoved: "Folder changed, downloads moved.",
    folderChanged: "Folder changed.",
    bgModels: "Background-removal models",
    upscaleEngines: "Upscale engines",
    inApp: "Available in the app.",
    aboutTitle: "About",
    about: (
      <p className="set-lead">
        <b>lil image</b> is a local image toolkit: compression, upscaling and
        background removal. Everything runs on your machine, nothing is sent to
        the network.
      </p>
    ),
  },
  skins: {
    brutal: { name: "Neo-brutalism", tagline: "hard borders, shadows, yellow" },
    riso: { name: "Riso-pop", tagline: "Japanese risograph, halftone" },
    te: { name: "TE Hardware", tagline: "instrument panel, rounded" },
  },
  mode: {
    toLightTitle: "Light theme",
    toDarkTitle: "Dark theme",
    toLightAria: "Switch to light theme",
    toDarkAria: "Switch to dark theme",
  },
  intake: {
    imagesFilter: "Images",
  },
  pipe: {
    label: "Next:",
  },
  toast: {
    saved: "Saved",
    openFolder: "Open folder",
    clear: "Clear and start over",
    close: "Close",
  },
  lang: {
    label: "Language",
    ru: "Русский",
    en: "English",
  },
  faq: {
    heading: "Which models the program reads",
    lead: "The program doesn't scan arbitrary files: it works from its own list of models and downloads them itself. Everything runs locally, no internet — the network is only needed while a model downloads.",
    bgTitle: "Background removal — ONNX format",
    bgCols: { model: "Model", weight: "Weight", input: "Input", memory: "Memory" },
    bgRows: {
      birefnet: "best quality, hair and fur edges",
      isnet: "crisp edges, good for portraits",
      u2netFull: "general-purpose, a solid balance",
      silueta: "U²-Net squeezed down to 42 MB",
      u2netLite: "the fastest, for quick tries",
    },
    bgNote: (
      <p className="faq-note">
        <b>Why BiRefNet is so hungry.</b> This export hard-codes the input at
        1024×1024 and it can't be reduced — the model simply refuses to run. The
        eight gigabytes don't go to the file itself but to the transformer's
        intermediate computations at that resolution. Short on memory? Take
        IS-Net: close quality, a fraction of the cost.
      </p>
    ),
    upTitle: "Upscaling — three engines to choose from",
    upIntro:
      "These aren't separate model files but a bundle: a binary plus weights. It runs on the GPU through Vulkan. You don't need all three — pick one.",
    upList: (
      <ul className="faq-list">
        <li>
          <b>Upscayl (ncnn)</b> — a December 2025 build, a living Real-ESRGAN
          fork. Five models: <b>Standard</b> (all-purpose), <b>Remacri</b> and{" "}
          <b>UltraSharp</b> (photo — the latter is harsher on sharpness),{" "}
          <b>Digital&nbsp;Art</b> (drawings and renders), <b>Lite</b> (fast).
          Start here.
        </li>
        <li>
          <b>Real-ESRGAN (ncnn)</b> — the 2022 original: General&nbsp;(x4plus),
          Anime&nbsp;(x4plus-anime), Anime&nbsp;video&nbsp;(v3, separate weights
          for ×2/×3/×4). A fallback if Upscayl doesn't get along with your GPU.
        </li>
        <li>
          <b>waifu2x (ncnn)</b> — a September 2025 build. It works differently:
          instead of "inventing" detail it cleans up and enlarges, with a
          separate denoise dial (0…3). The best choice for anime, line art and
          scans — where Real-ESRGAN tends to turn lines into plastic.
        </li>
      </ul>
    ),
    locTitle: "Where the models live",
    locBody: (
      <p>
        By default — in the app's system folder, which is often the C: drive. If
        space there is tight, open <b>Settings → Model storage</b> and pick any
        other folder (even right next to the program). Already-downloaded models
        can be moved there too, with the checkbox.
      </p>
    ),
    compressTitle: "Compression — no models",
    compressBody:
      "Compression needs no models and works right away: the MozJPEG, WebP, AVIF and OxiPNG codecs are built into the program itself.",
    dirTitle: "Where downloaded models are stored",
    dirNote: (
      <p className="faq-note">
        You can delete the folder wholesale — the program won't break, it'll just
        offer to download the models again. Dropping your own <code>.onnx</code>{" "}
        in there isn't possible yet: only the models listed above are read.
      </p>
    ),
  },
};

export const DICTS: Record<"ru" | "en", Dict> = { ru, en };

export type { ReactNode };

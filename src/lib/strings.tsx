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
    back: "Назад",
    modelsTitle: "МОДЕЛИ",
    settingsTitle: "НАСТРОЙКИ",
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
    continue: "Продолжить",
    batchEntry: "Обработать несколько / папку",
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
    custom: "Своё",
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
  batch: {
    title: "НЕСКОЛЬКО",
    tab: "Несколько",
    source: "Источник",
    dest: "Назначение",
    sourcePh: "Папка с изображениями…",
    destPh: "Куда сохранять…",
    pickFolder: "Папка…",
    remember: "Запомнить",
    operation: "Операция",
    found: (n: number) => `Найдено изображений: ${n}`,
    empty: "В папке нет изображений",
    process: "Обработать все →",
    cancel: "Отмена",
    done: (ok: number, total: number) => `Готово: ${ok} из ${total}.`,
    needEngine: "Сначала скачайте движок апскейла в Настройках.",
    needModel: "Сначала скачайте модель фона в Настройках.",
    browser: (
      <p>
        <b>Пакетная обработка работает в приложении lil edit.</b> Ей нужен доступ
        к папкам на диске, которого нет в браузере. Запусти{" "}
        <code>npm run tauri dev</code>.
      </p>
    ),
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
    scaleOneTip:
      "«Шумодав» не увеличивает картинку — она остаётся в исходном размере, модель только убирает шум и артефакты сжатия. Есть у waifu2x с моделью cunet.",
    denoiseSeg: "Шумодав",
    denoiseOnly: "Размер не меняется — только убираем шум и артефакты сжатия.",
    denoise: "Сила",
    denoiseTip:
      "Сила шумоподавления. Работает и при увеличении, а не только в «Шумодаве»: у waifu2x под каждый масштаб есть отдельные модели с чисткой, так что шум убирается за тот же проход. «Нет» — увеличить, ничего не трогая.",
    denoiseNone: "нет",
    run: "Увеличить →",
    running: "Апскейл…",
    runAt: (n: number) => `Увеличить ×${n} →`,
    runDenoise: "Убрать шум →",
    runningDenoise: "Чистим…",
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
        <b>Апскейл работает в приложении lil edit.</b> Ему нужен движок ncnn и
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
    edge: "Края",
    hardness: "Жёсткость",
    grow: "Расширить / сузить, px",
    feather: "Растушёвка, px",
    edgeReset: "сбросить",
    adjusting: "применяю…",
    edgeNote:
      "Обрабатывает только края готовой маски — это не настройка самой модели. Скорость зависит от размера изображения и мощности устройства.",
    hardnessTip:
      "Сдвигает границу фон/объект. Чем выше, тем сильнее полупрозрачные пиксели по краю становятся либо полностью видимыми, либо полностью убранными — убирает серую/мутную кайму. Рекомендация: 20–50.",
    growTip:
      "Наращивает (+) или ужимает (−) вырез. Минус съедает остаточный фон по краю; плюс возвращает срезанный край объекта (в кадр вернётся настоящий край фото). Рекомендация: −2…−1, если осталась кайма.",
    featherTip:
      "Размывает границу для мягкого края. Рекомендация: 1–2 px; для резкого выреза оставьте 0.",
    details: "Модели для удаления фона",
    onboardTitle: "Выберите модель",
    onboard: (
      <p>
        Скачивается один раз, работает <b>локально и офлайн</b>. Топ качества —{" "}
        <b>BiRefNet</b>; для быстрой пробы хватит <b>U²-Net (lite)</b>.
      </p>
    ),
    browser: (
      <p>
        <b>Удаление фона работает в приложении lil edit.</b> Ему нужен локальный
        AI-движок из Rust-бэкенда, которого нет в браузере. Запусти{" "}
        <code>npm run tauri dev</code> — там всё заработает.
      </p>
    ),
  },
  compare: {
    modeHold: "Зажать",
    modeSplit: "Ползунок",
    modeSide: "Рядом",
    loupe: "🔍 Лупа",
    loupeTitle: "Лупа: наведите на изображение",
    zoomReset: "Сбросить масштаб (или двойной клик)",
    zoomHint: (k: string) => `${k} + колесо или пинч — приблизить`,
    matteLabel: "Фон:",
    matteAria: "Подложка",
    matteTheme: "Цвет темы",
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
    cancel: "Отменить",
    cancelling: "отмена…",
    installed: "УСТАНОВЛЕНО",
    extract: "распаковка…",
    done: "готово",
    dir: "Модели:",
  },
  settings: {
    appearance: "Оформление",
    tabModels: "Модели",
    tabStorage: "Хранилище",
    tabLook: "Оформление",
    tabAbout: "О программе",
    appearanceLead:
      "Скин меняет весь интерфейс — цвета, шрифты, формы и анимации. Выбор запоминается.",
    theme: "Тема",
    modelsFaq: "Какие модели читает программа",
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
    version: "Версия",
    about: (
      <p className="set-lead">
        <b>lil edit</b> — локальный набор инструментов для изображений: сжатие,
        апскейл и удаление фона. Всё считается на вашем компьютере, без отправки
        в сеть.
      </p>
    ),
    update: {
      check: "Проверить обновление",
      checking: "Проверяем…",
      upToDate: "У вас последняя версия",
      failed: "Не удалось проверить обновления",
      available: (v: string) => `Доступна версия ${v}`,
      whatsNew: "Что нового",
      download: "Скачать",
      releasePage: "Страница релиза",
      badgeAria: "Доступно обновление",
      auto: "Проверять обновления при запуске",
      autoNote:
        "Единственное, ради чего приложение само выходит в сеть. Выключите — и без вашей команды оно не откроет ни одного соединения.",
    },
  },
  skins: {
    brutal: { name: "Нео-брутализм" },
    riso: { name: "Рисо-поп" },
    te: { name: "Девайс" },
    studio: { name: "lil studio" },
  },
  mode: {
    light: "Светлая",
    dark: "Тёмная",
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
    // Заголовок тоста после сохранения — по одной случайной реплике на
    // инструмент. Имя файла рядом остаётся, так что смысл не теряется.
    quips: {
      upscale: ["Ух, какой большой", "Нормальный размер", "Немало", "Больше некуда"],
      background: ["Точно PNG", "…и в продакшен", "А где всё?"],
      edit: ["Вот теперь нормально", "Как и хотел", "'дём дальше", "Лишнее — за кадром"],
      compress: ["Шакалов.нет", "Скукожило", "И так сойдёт"],
    } as Record<string, string[]>,
  },
  lang: {
    label: "Язык",
    ru: "Русский",
    en: "English",
  },
  faq: {
    heading: "Какие модели читает программа",
    lead: "Программа не сканирует произвольные файлы: она работает со своим списком моделей и скачивает их сама. Всё считается локально, без интернета — сеть нужна только в момент загрузки модели.",
    typesTitle: "Какие типы моделей поддерживаются",
    types: (
      <ul className="faq-list">
        <li>
          <b>Удаление фона</b> — модели формата <b>ONNX</b> (архитектуры U²-Net,
          IS-Net, BiRefNet), совместимые с rembg.
        </li>
        <li>
          <b>Апскейл</b> — движки <b>ncnn-vulkan</b> (Real-ESRGAN, Upscayl,
          waifu2x): бинарник плюс веса <code>.param</code>/<code>.bin</code>.
        </li>
        <li>
          Всё берётся из встроенного списка и скачивается менеджером внутри
          приложения. Подключить свой файл модели пока нельзя.
        </li>
      </ul>
    ),
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
    back: "Back",
    modelsTitle: "MODELS",
    settingsTitle: "SETTINGS",
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
    continue: "Continue",
    batchEntry: "Batch / whole folder",
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
    custom: "Custom",
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
  batch: {
    title: "BATCH",
    tab: "Batch",
    source: "Source",
    dest: "Destination",
    sourcePh: "Folder of images…",
    destPh: "Where to save…",
    pickFolder: "Folder…",
    remember: "Remember",
    operation: "Operation",
    found: (n: number) => `Images found: ${n}`,
    empty: "No images in this folder",
    process: "Process all →",
    cancel: "Cancel",
    done: (ok: number, total: number) => `Done: ${ok} of ${total}.`,
    needEngine: "Download an upscale engine in Settings first.",
    needModel: "Download a background model in Settings first.",
    browser: (
      <p>
        <b>Batch processing runs in the lil edit app.</b> It needs folder access
        the browser doesn't have. Run <code>npm run tauri dev</code>.
      </p>
    ),
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
    scaleOneTip:
      "\"Denoise\" doesn't enlarge anything — the image keeps its original size and the model only removes noise and compression artefacts. Available on waifu2x with the cunet model.",
    denoiseSeg: "Denoise",
    denoiseOnly: "Same size — noise and compression artefacts only.",
    denoise: "Strength",
    denoiseTip:
      "Denoising strength. It applies while upscaling too, not only in Denoise mode: waifu2x ships a cleaning model for each scale, so the noise goes in the same pass. \"Off\" upscales without touching it.",
    denoiseNone: "off",
    run: "Upscale →",
    running: "Upscaling…",
    runAt: (n: number) => `Upscale ×${n} →`,
    runDenoise: "Remove noise →",
    runningDenoise: "Cleaning…",
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
        <b>Upscaling runs in the lil edit app.</b> It needs the ncnn engine and
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
    edge: "Edges",
    hardness: "Hardness",
    grow: "Grow / shrink, px",
    feather: "Feather, px",
    edgeReset: "reset",
    adjusting: "applying…",
    edgeNote:
      "Only touches the edges of the finished mask — it's not a setting of the model itself. Speed depends on image size and your device.",
    hardnessTip:
      "Shifts the subject/background cutoff. Higher pushes semi-transparent edge pixels to fully kept or fully cut — clears a gray fringe. Suggested: 20–50.",
    growTip:
      "Grows (+) or shrinks (−) the cut-out. Minus eats a leftover background fringe; plus restores a clipped edge (real photo pixels come back). Suggested: −2…−1 if a fringe remains.",
    featherTip:
      "Blurs the edge for a softer cut-out. Suggested: 1–2 px; leave at 0 for a crisp edge.",
    details: "Background removal models",
    onboardTitle: "Pick a model",
    onboard: (
      <p>
        Downloaded once, runs <b>locally and offline</b>. Best quality is{" "}
        <b>BiRefNet</b>; for a quick try <b>U²-Net (lite)</b> is enough.
      </p>
    ),
    browser: (
      <p>
        <b>Background removal runs in the lil edit app.</b> It needs the local
        AI engine in the Rust backend, which the browser doesn't have. Run{" "}
        <code>npm run tauri dev</code> and it'll work there.
      </p>
    ),
  },
  compare: {
    modeHold: "Hold",
    modeSplit: "Slider",
    modeSide: "Side by side",
    loupe: "🔍 Loupe",
    loupeTitle: "Loupe: hover the image",
    zoomReset: "Reset zoom (or double-click)",
    zoomHint: (k: string) => `${k} + wheel or pinch to zoom`,
    matteLabel: "Backdrop:",
    matteAria: "Backdrop",
    matteTheme: "Theme colour",
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
    cancel: "Cancel",
    cancelling: "cancelling…",
    installed: "INSTALLED",
    extract: "extracting…",
    done: "done",
    dir: "Models:",
  },
  settings: {
    appearance: "Appearance",
    tabModels: "Models",
    tabStorage: "Storage",
    tabLook: "Appearance",
    tabAbout: "About",
    appearanceLead:
      "A skin changes the whole interface — colors, fonts, shapes and animations. Your choice is remembered.",
    theme: "Theme",
    modelsFaq: "Which models the program reads",
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
    version: "Version",
    about: (
      <p className="set-lead">
        <b>lil edit</b> is a local image toolkit: compression, upscaling and
        background removal. Everything runs on your machine, nothing is sent to
        the network.
      </p>
    ),
    update: {
      check: "Check for updates",
      checking: "Checking…",
      upToDate: "You're on the latest version",
      failed: "Couldn't check for updates",
      available: (v: string) => `Version ${v} is available`,
      whatsNew: "What's new",
      download: "Download",
      releasePage: "Release page",
      badgeAria: "Update available",
      auto: "Check for updates on launch",
      autoNote:
        "The only thing the app reaches out for on its own. Turn it off and it opens no connection unless you ask it to.",
    },
  },
  skins: {
    brutal: { name: "Neo-brutalism" },
    riso: { name: "Riso-pop" },
    te: { name: "Device" },
    studio: { name: "lil studio" },
  },
  mode: {
    light: "Light",
    dark: "Dark",
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
    // Written rather than translated — the Russian ones lean on local memes
    // that don't survive the trip.
    quips: {
      upscale: [
        "That's a big one",
        "Enhance. Enhance. Enhance.",
        "Now with extra pixels",
        "Bigger. Obviously.",
        "Zoom in, it holds up",
      ],
      background: [
        "Definitely a PNG",
        "…and into production",
        "Where'd it all go?",
        "Background: dismissed",
        "Cut clean",
      ],
      edit: [
        "Now that's better",
        "Just as ordered",
        "Onwards",
        "Straight, finally",
        "Cropped to taste",
      ],
      compress: [
        "No JPEG artefacts were harmed",
        "Squished",
        "Good enough, honestly",
        "Megabytes have left the chat",
        "Lost weight, kept the looks",
      ],
    } as Record<string, string[]>,
  },
  lang: {
    label: "Language",
    ru: "Русский",
    en: "English",
  },
  faq: {
    heading: "Which models the program reads",
    lead: "The program doesn't scan arbitrary files: it works from its own list of models and downloads them itself. Everything runs locally, no internet — the network is only needed while a model downloads.",
    typesTitle: "Which model types are supported",
    types: (
      <ul className="faq-list">
        <li>
          <b>Background removal</b> — <b>ONNX</b> models (U²-Net, IS-Net,
          BiRefNet architectures), rembg-compatible.
        </li>
        <li>
          <b>Upscaling</b> — <b>ncnn-vulkan</b> engines (Real-ESRGAN, Upscayl,
          waifu2x): a binary plus <code>.param</code>/<code>.bin</code> weights.
        </li>
        <li>
          Everything comes from the built-in list and is fetched by the in-app
          manager. Adding your own model file isn't supported yet.
        </li>
      </ul>
    ),
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

# lil edit

**English** · [Русский](README.ru.md)

A cross-platform desktop app for working with images: **compression**, **background
removal**, and **upscaling**. All processing happens on your machine — your images are
never uploaded anywhere. See [What goes over the network](#what-goes-over-the-network).

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Tauri](https://img.shields.io/badge/built%20with-Tauri%202-24C8DB)
![Platforms](https://img.shields.io/badge/platforms-macOS%20·%20Windows%20·%20Linux-555)

Part of the **lil** set — small local tools that each do one thing:

| | |
|---|---|
| **lil edit** | reshape it: compress, cut out the background, upscale — you are here |
| [lil view](https://github.com/mitya-lsnk/lil-view) | look at it: a fast macOS image viewer |

---

## What works

| Feature | Status | Engine |
|---|---|---|
| **Compression** | ✅ done, tested | jSquash (WASM): MozJPEG, WebP, AVIF, OxiPNG |
| **Editing** | ✅ done | Crop (aspect presets), resize (px/%), rotate/flip — on-canvas, no models |
| **Batch** | ✅ done | Run one operation over a whole folder (upscale / bg / compress / resize), progress + destination folder |
| **Model manager** | ✅ done | Download with progress + unpack, in Rust |
| **Background removal** | ✅ implemented | ONNX (BiRefNet / U²-Net / IS-Net / Silueta) via `ort` |
| **Upscaling** | ✅ implemented | Three ncnn-vulkan engines: Upscayl, Real-ESRGAN, waifu2x |
| **Interface language** | ✅ done | Russian / English, switchable in-app |
| **Theming** | ✅ done | Three skins × light/dark |

> Compression is tested end-to-end in the real frontend (3.3 MB → 20–48 KB across all
> four codecs). Background removal is covered by an integration test against real u2netp
> weights. Upscaling and the full background UI path are best run manually (see below) —
> they require downloading 4–170 MB models.

---

## Interface language

The UI ships in **Russian and English**. On first launch it follows your OS locale
(a Russian system → Russian, otherwise English); after that, the **RU/EN toggle** in
the header wins and the choice is remembered. All user-facing text lives in
[`src/lib/strings.tsx`](src/lib/strings.tsx) — add a key to the `ru` object and the
compiler will require the matching `en` value.

---

## Tech stack

- **Tauri 2** — shell (Rust backend + system WebView). Light, ~10 MB runtime.
- **React + TypeScript + Vite** — frontend.
- **jSquash** — WASM compression codecs (the same ones Squoosh uses).
- **ort** (onnxruntime) — ONNX runtime for background removal.
- **ncnn-vulkan engines** — GPU upscaling through Vulkan, fetched by the model manager.

---

## Getting started

Requires Node ≥ 20 and Rust.

```bash
npm install          # first time only
npm run tauri dev    # run the app in dev mode
```

Build a release `.app` / `.dmg` / `.exe`:

```bash
npm run tauri build
```

The macOS build lands in `src-tauri/target/release/bundle/` — `macos/lil edit.app`
plus a `.dmg`. Drag the `.app` into `/Applications` and launch it from Launchpad or
Spotlight like any other app: no terminal, no dev server, no port to keep free.

> Running `npm run dev` opens the frontend in a plain browser. Compression works there,
> but background removal and upscaling need the Rust backend, and the "save next to the
> original" default needs the native file path — both only exist in the Tauri app.

---

## Manual test checklist

1. **Compression** (no downloads needed): drop an image, pick a format, adjust quality,
   Compress, compare before/after, Save.
2. **Background removal**: download **U²-Net (lite)** (4.4 MB, quick) or **IS-Net (general)**
   (better for portraits), pick it, Remove background. Result is a transparent PNG.
3. **Upscaling**: download an engine (Upscayl ~115 MB, Real-ESRGAN ~49 MB, waifu2x ~35 MB).
   Install more than one and an engine switcher appears. Pick a model and scale, Upscale.
   waifu2x also has a denoise dial.
   - macOS note: if Gatekeeper blocks a downloaded binary, the app already tries to strip
     the quarantine flag (`xattr`); if that fails, allow it in System Settings → Privacy
     & Security.

---

## Models (registry)

The registry lives in [`src-tauri/src/models.rs`](src-tauri/src/models.rs). Links are
direct and were verified 2026-07-19.

**Background removal (ONNX):**
- U²-Net lite — `u2netp.onnx` (4.4 MB) — https://github.com/danielgatis/rembg
- U²-Net full — `u2net.onnx` (168 MB)
- IS-Net general — `isnet-general-use.onnx` (170 MB)
- Silueta — `silueta.onnx` (42 MB)

**Upscaling (ncnn, per-OS archive chosen at compile time):**
- Upscayl — binary (Dec 2025 build) + 5 models — ~115 MB — https://github.com/upscayl/upscayl-ncnn
- Real-ESRGAN ncnn-vulkan — 45–49 MB — https://github.com/xinntao/Real-ESRGAN
- waifu2x-ncnn-vulkan (Sep 2025 build) — 35–42 MB — https://github.com/nihui/waifu2x-ncnn-vulkan

By default models go to `<app_data_dir>/models` (macOS:
`~/Library/Application Support/com.lil.edit/models`). The folder is configurable:
**Settings → Model storage → Choose folder…**; the "move what's already downloaded"
checkbox relocates existing files (via copy+delete, so switching drives works).

To add a model, append an entry to `REGISTRY` in `models.rs` (id, url, size, category).

Every download is pinned to a **SHA-256 checksum** verified before the file is used. A
mismatch deletes the download and reports an error, so a tampered or truncated artifact
never gets unpacked or executed.

---

## What goes over the network

Your images never leave the machine — there is no upload, no telemetry, no analytics,
no crash reporting, and no account. The app opens exactly three kinds of connection,
all of them to public, pinned URLs:

| When | Where | What is sent |
|---|---|---|
| **On launch** — update check | `api.github.com` (this repo's latest release) | Nothing but the request itself: your IP and a `lil-edit/<version>` User-Agent. Can be turned off: **Settings → Check for updates on launch**. |
| **You click Download** on a model or engine | GitHub Releases / raw.githubusercontent / HuggingFace | Nothing but the request. Never automatic. |
| **You click a link** (project page, release notes) | Your browser, not the app | — |

Turning the update check off makes the app fully silent: with the models already
downloaded it never opens a connection on its own.

---

## Project structure

```
lil-edit/
├── src/                      # frontend (React)
│   ├── App.tsx               # shell, tabs
│   ├── lib/
│   │   ├── compress.ts       # jSquash compression pipeline
│   │   ├── models.ts         # bridge to the model-manager commands
│   │   ├── ai.ts             # bridge to remove_background / upscale_image
│   │   ├── save.ts           # native save dialog (defaults to the original's folder)
│   │   ├── intake.ts         # file intake: native drag-drop/dialog, yields the path
│   │   ├── fsx.ts            # file read/write bypassing the fs-plugin scope
│   │   ├── i18n.tsx          # language context (RU/EN), follows OS, persists
│   │   ├── edit.ts           # crop / resize / rotate / flip on a <canvas>
│   │   ├── engines.ts        # shared upscale engine/model registry
│   │   ├── batch.ts          # folder batch: one operation over many files
│   │   └── strings.tsx       # all UI text, both languages
│   └── components/
│       ├── DropZone.tsx
│       ├── CompressPanel.tsx
│       ├── EditPanel.tsx
│       ├── BatchPanel.tsx
│       ├── BackgroundPanel.tsx
│       ├── UpscalePanel.tsx
│       ├── ModelManager.tsx
│       └── LanguagePicker.tsx
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs            # plugin + command registration
│   │   ├── models.rs         # registry + download/unpack
│   │   ├── bg.rs             # background removal (ort/ONNX) + test
│   │   ├── ai.rs             # upscaling: three-engine ncnn dispatcher
│   │   ├── settings.rs       # settings.json (models-folder override)
│   │   └── fsx.rs            # read_file_bytes / write_file_bytes
│   └── tauri.conf.json
└── sample.png                # test gradient
```

---

## Roadmap / known limits

- **IPC byte transfer** for background/upscale still goes as a number array — inefficient
  for very large images. Later: temp file or raw IPC.
- **Compression on the main thread** — large AVIF can stutter the UI. Later: Web Worker.
- Batch processing, export presets — not done yet.

---

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

## Third-party licenses

lil edit's own code is MIT (see [LICENSE](LICENSE)). The upscale engines and ONNX
models are **downloaded at runtime** and each carries its own license (Tauri, jSquash,
ort, Upscayl-ncnn, Real-ESRGAN, waifu2x, and the model weights) — follow the source
links in the registry above for the exact terms.

## License

[MIT](LICENSE) © 2026 lsnk

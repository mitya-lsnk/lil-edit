// Model registry + downloader for background-removal (ONNX) and upscale (ncnn) assets.
//
// Everything is stored under the models folder — by default <app_data_dir>/models,
// but the user can point it at any drive (see `set_models_dir`). Each entry either
// lands as a single file (e.g. an .onnx) or, when `archive` is true, is downloaded
// as a .zip and extracted into <models>/<id>/. Archive entries may additionally
// pull `extras` — loose weight files that the engine ships without — into
// <models>/<id>/models/.

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

use futures_util::StreamExt;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::AsyncWriteExt;

use crate::settings;

/// Error sentinel used when a download is aborted by the user, so the wrapper
/// can tell a cancel apart from a real failure.
const CANCEL_MARKER: &str = "__cancelled__";

/// Ids the user has asked to cancel mid-download. A download loop checks this
/// between chunks and bails out; the id is cleared once the download unwinds.
fn cancels() -> &'static Mutex<HashSet<String>> {
    static C: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();
    C.get_or_init(|| Mutex::new(HashSet::new()))
}

fn cancel_requested(id: &str) -> bool {
    cancels().lock().map(|s| s.contains(id)).unwrap_or(false)
}

fn clear_cancel(id: &str) {
    if let Ok(mut s) = cancels().lock() {
        s.remove(id);
    }
}

/// Ask an in-flight download to stop. Harmless if nothing is downloading.
#[tauri::command]
pub fn cancel_download(id: String) {
    if let Ok(mut s) = cancels().lock() {
        s.insert(id);
    }
}

/// An extra file fetched alongside an archive: (url, file name, byte size, sha256).
pub type Extra = (&'static str, &'static str, u64, &'static str);

/// A downloadable model or tool bundle.
#[derive(Clone, Serialize)]
pub struct ModelSpec {
    pub id: &'static str,
    pub name: &'static str,
    /// "background" or "upscale"
    pub category: &'static str,
    pub description: &'static str,
    /// Direct download URL.
    pub url: &'static str,
    /// File name to save as (single-file models). For archives this is the .zip name.
    pub file: &'static str,
    /// Human-readable size.
    pub size: &'static str,
    /// Approx byte size (for progress when server omits content-length).
    pub bytes: u64,
    /// Lowercase hex SHA-256 of the downloaded artifact, verified before it is
    /// unpacked or run. These are executables we chmod +x and (on macOS) strip
    /// quarantine from, so "HTTPS to a pinned URL" is not enough on its own: a
    /// moved tag or a compromised upstream release would otherwise hand us
    /// arbitrary code. Empty means unpinned — allowed, but nothing ships that way.
    pub sha256: &'static str,
    /// If true, `file` is a zip that gets extracted into <models>/<id>/.
    pub archive: bool,
    /// Loose files downloaded into <models>/<id>/models/ after extraction.
    pub extras: &'static [Extra],
    /// For archives: a file that must exist somewhere under <models>/<id>/ for the
    /// entry to count as installed. Empty means "any non-empty folder will do".
    /// Engines put their platform binary here so a wrong-OS extraction (which can't
    /// launch — os error 193) doesn't read as installed and block the re-download.
    pub marker: &'static str,
    /// Project / source page for reference.
    pub homepage: &'static str,
    /// License note.
    pub license: &'static str,
    /// Short quality/speed tag shown as a badge (e.g. "SOTA", "быстрая").
    pub tag: &'static str,
}

// ---------------------------------------------------------------------------
// Upscale engines. Each ships a separate ncnn-vulkan archive per OS, so the
// right one is picked at compile time: (url, zip name, human size, byte size,
// sha256). The hashes are verified before the archive is unpacked — see
// `verify_sha256`. Re-derive one with:
//   curl -sL <url> | shasum -a 256
// ---------------------------------------------------------------------------

/// (url, file name, human size, byte size, sha256)
type EngineSpec = (&'static str, &'static str, &'static str, u64, &'static str);

#[cfg(target_os = "windows")]
const REALESRGAN: EngineSpec = (
    "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-windows.zip",
    "realesrgan-ncnn-vulkan-windows.zip",
    "45 МБ",
    45_474_481,
    "abc02804e17982a3be33675e4d471e91ea374e65b70167abc09e31acb412802d",
);
#[cfg(target_os = "linux")]
const REALESRGAN: EngineSpec = (
    "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-ubuntu.zip",
    "realesrgan-ncnn-vulkan-ubuntu.zip",
    "47 МБ",
    46_931_474,
    "e5aa6eb131234b87c0c51f82b89390f5e3e642b7b70f2b9bbe95b6a285a40c96",
);
#[cfg(target_os = "macos")]
const REALESRGAN: EngineSpec = (
    "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-macos.zip",
    "realesrgan-ncnn-vulkan-macos.zip",
    "49 МБ",
    51_817_124,
    "e0ad05580abfeb25f8d8fb55aaf7bedf552c375b5b4d9bd3c8d59764d2cc333a",
);

// Upscayl's maintained fork of realesrgan-ncnn-vulkan (build 2025-12-07). Same
// CLI, newer ncnn; the binary ships with no weights at all, hence UPSCAYL_MODELS.
#[cfg(target_os = "windows")]
const UPSCAYL: EngineSpec = (
    "https://github.com/upscayl/upscayl-ncnn/releases/download/20251207-174704/upscayl-bin-20251207-174704-windows.zip",
    "upscayl-bin-windows.zip",
    "115 МБ",
    2_421_760,
    "1f0f65c5d2ade866555e2ac467d35952c35a47080a4060fe56a1ab028f67258a",
);
#[cfg(target_os = "linux")]
const UPSCAYL: EngineSpec = (
    "https://github.com/upscayl/upscayl-ncnn/releases/download/20251207-174704/upscayl-bin-20251207-174704-linux.zip",
    "upscayl-bin-linux.zip",
    "117 МБ",
    3_952_825,
    "a9fab3c770b62f2b7a35d8d6d61eb4e8b3aef79128b665c919d080b85a2292f2",
);
#[cfg(target_os = "macos")]
const UPSCAYL: EngineSpec = (
    "https://github.com/upscayl/upscayl-ncnn/releases/download/20251207-174704/upscayl-bin-20251207-174704-macos.zip",
    "upscayl-bin-macos.zip",
    "122 МБ",
    9_338_240,
    "277419791281a56eae0c739c70120b974d7267cf7c2de8e86dc09798d4b314db",
);

// Weights for the Upscayl engine, pinned to an immutable tag. Sizes and hashes
// verified 2026-07-27 — the size drives the progress bar and the "installed"
// check, the hash is enforced before the file is accepted.
const UPSCAYL_MODELS: &[Extra] = &[
    (
        "https://raw.githubusercontent.com/upscayl/upscayl/v2.15.0/resources/models/upscayl-standard-4x.param",
        "upscayl-standard-4x.param",
        116_029,
        "35330ececcea33b6c397a72548e788d5d53becee4734c50b7fada36e89f10a86",
    ),
    (
        "https://raw.githubusercontent.com/upscayl/upscayl/v2.15.0/resources/models/upscayl-standard-4x.bin",
        "upscayl-standard-4x.bin",
        33_424_520,
        "713ee713b0353afaa27976f0563a64a5043bd70b9bd8936c2e26e25ebcdbcddf",
    ),
    (
        "https://raw.githubusercontent.com/upscayl/upscayl/v2.15.0/resources/models/upscayl-lite-4x.param",
        "upscayl-lite-4x.param",
        5_019,
        "22174924330297357434ad21ed0af7f4b820008d2a502b492754d130d4142714",
    ),
    (
        "https://raw.githubusercontent.com/upscayl/upscayl/v2.15.0/resources/models/upscayl-lite-4x.bin",
        "upscayl-lite-4x.bin",
        2_435_272,
        "85ee266b632a765a725425ba6a5620c088c8aa2939a03063b2d83b3462724cc1",
    ),
    (
        "https://raw.githubusercontent.com/upscayl/upscayl/v2.15.0/resources/models/remacri-4x.param",
        "remacri-4x.param",
        140_295,
        "859ecba5b3592ecf3e76c93bed65e9f627b5236dd696aae5a84ecf8c93ab65ce",
    ),
    (
        "https://raw.githubusercontent.com/upscayl/upscayl/v2.15.0/resources/models/remacri-4x.bin",
        "remacri-4x.bin",
        33_424_520,
        "a43be595c0d743314c30b50fe7ef188be0c61cc55c46ce81adb79ba4b3c3fb7a",
    ),
    (
        "https://raw.githubusercontent.com/upscayl/upscayl/v2.15.0/resources/models/ultrasharp-4x.param",
        "ultrasharp-4x.param",
        116_029,
        "0136ca83686809a8f17f7111f11b951e8db93610e24b7f4137c9ffe4dbc4a806",
    ),
    (
        "https://raw.githubusercontent.com/upscayl/upscayl/v2.15.0/resources/models/ultrasharp-4x.bin",
        "ultrasharp-4x.bin",
        33_424_520,
        "fb3e279d40d4cddb44db4e684d59e68d0aa39852c8cc14dc3f23ccc7e6eee9c1",
    ),
    (
        "https://raw.githubusercontent.com/upscayl/upscayl/v2.15.0/resources/models/digital-art-4x.param",
        "digital-art-4x.param",
        30_290,
        "2b8fb6e0ae4d2d85704ca08c119a2f5ea40add4f2ecd512eb7f4cd44b6127ed4",
    ),
    (
        "https://raw.githubusercontent.com/upscayl/upscayl/v2.15.0/resources/models/digital-art-4x.bin",
        "digital-art-4x.bin",
        8_943_500,
        "fe01c269cfd10cdef8e018ab66ebe750cf79c7af4d1f9c16c737e1295229bacc",
    ),
];

// waifu2x-ncnn-vulkan (build 2025-09-15) — self-contained, models included.
#[cfg(target_os = "windows")]
const WAIFU2X: EngineSpec = (
    "https://github.com/nihui/waifu2x-ncnn-vulkan/releases/download/20250915/waifu2x-ncnn-vulkan-20250915-windows.zip",
    "waifu2x-ncnn-vulkan-windows.zip",
    "35 МБ",
    35_497_352,
    "7425be94b94e4c8f37a1e433ac0e0100c43790e2c37418f4b65d8235adfbdc87",
);
#[cfg(target_os = "linux")]
const WAIFU2X: EngineSpec = (
    "https://github.com/nihui/waifu2x-ncnn-vulkan/releases/download/20250915/waifu2x-ncnn-vulkan-20250915-linux.zip",
    "waifu2x-ncnn-vulkan-linux.zip",
    "37 МБ",
    36_658_685,
    "848e0fba55657d34da90b775b8139e9806dc754798b029f95e106ba8850a731f",
);
#[cfg(target_os = "macos")]
const WAIFU2X: EngineSpec = (
    "https://github.com/nihui/waifu2x-ncnn-vulkan/releases/download/20250915/waifu2x-ncnn-vulkan-20250915-macos.zip",
    "waifu2x-ncnn-vulkan-macos.zip",
    "42 МБ",
    41_706_129,
    "a5b58b239eb3aa030db5464f6759637fe412d8c07891a4346ea57f708b514d42",
);

/// Engine binary names on this platform (Windows carries .exe).
#[cfg(windows)]
pub const REALESRGAN_BIN: &str = "realesrgan-ncnn-vulkan.exe";
#[cfg(not(windows))]
pub const REALESRGAN_BIN: &str = "realesrgan-ncnn-vulkan";
#[cfg(windows)]
pub const UPSCAYL_BIN: &str = "upscayl-bin.exe";
#[cfg(not(windows))]
pub const UPSCAYL_BIN: &str = "upscayl-bin";
#[cfg(windows)]
pub const WAIFU2X_BIN: &str = "waifu2x-ncnn-vulkan.exe";
#[cfg(not(windows))]
pub const WAIFU2X_BIN: &str = "waifu2x-ncnn-vulkan";

/// The full registry. Links verified reachable on 2026-07-25.
pub const REGISTRY: &[ModelSpec] = &[
    ModelSpec {
        id: "birefnet",
        name: "BiRefNet",
        category: "background",
        description: "State-of-the-art (2024). The cleanest edges — hair, fur, fine detail. Large & slower, best quality.",
        url: "https://huggingface.co/onnx-community/BiRefNet-ONNX/resolve/main/onnx/model.onnx",
        file: "birefnet.onnx",
        size: "928 МБ",
        bytes: 972_666_916,
        // HuggingFace stores LFS objects under their SHA-256, so this is the
        // `lfs.oid` the model API reports for onnx/model.onnx.
        sha256: "58f621f00f5d756097615970a88a791584600dcf7c45b18a0a6267535a1ebd3c",
        archive: false,
        extras: &[],
        marker: "",
        homepage: "https://github.com/ZhengPeng7/BiRefNet",
        license: "MIT",
        tag: "SOTA · лучшее качество",
    },
    ModelSpec {
        id: "u2netp",
        name: "U²-Net (lite)",
        category: "background",
        description: "Tiny, fast background matting. Great default to try things out.",
        url: "https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx",
        file: "u2netp.onnx",
        size: "4.4 МБ",
        bytes: 4_574_861,
        sha256: "309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8",
        archive: false,
        extras: &[],
        marker: "",
        homepage: "https://github.com/danielgatis/rembg",
        license: "Apache-2.0 (rembg) / U²-Net weights",
        tag: "быстрая",
    },
    ModelSpec {
        id: "u2net",
        name: "U²-Net (full)",
        category: "background",
        description: "Full-size general background removal. Better quality than the lite model.",
        url: "https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net.onnx",
        file: "u2net.onnx",
        size: "168 МБ",
        bytes: 175_997_641,
        sha256: "8d10d2f3bb75ae3b6d527c77944fc5e7dcd94b29809d47a739a7a728a912b491",
        archive: false,
        extras: &[],
        marker: "",
        homepage: "https://github.com/danielgatis/rembg",
        license: "Apache-2.0 (rembg) / U²-Net weights",
        tag: "баланс",
    },
    ModelSpec {
        id: "isnet-general-use",
        name: "IS-Net (general)",
        category: "background",
        description: "Sharper edges (hair/fur) than U²-Net. Recommended for portraits.",
        url: "https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx",
        file: "isnet-general-use.onnx",
        size: "170 МБ",
        bytes: 178_648_008,
        sha256: "60920e99c45464f2ba57bee2ad08c919a52bbf852739e96947fbb4358c0d964a",
        archive: false,
        extras: &[],
        marker: "",
        homepage: "https://github.com/danielgatis/rembg",
        license: "Apache-2.0 (rembg) / IS-Net (DIS) weights",
        tag: "точная",
    },
    ModelSpec {
        id: "silueta",
        name: "Silueta",
        category: "background",
        description: "U²-Net distilled to a smaller size with similar quality.",
        url: "https://github.com/danielgatis/rembg/releases/download/v0.0.0/silueta.onnx",
        file: "silueta.onnx",
        size: "42 МБ",
        bytes: 44_173_029,
        sha256: "75da6c8d2f8096ec743d071951be73b4a8bc7b3e51d9a6625d63644f90ffeedb",
        archive: false,
        extras: &[],
        marker: "",
        homepage: "https://github.com/danielgatis/rembg",
        license: "Apache-2.0 (rembg)",
        tag: "компактная",
    },
    ModelSpec {
        id: "upscayl-ncnn",
        name: "Upscayl (ncnn)",
        category: "upscale",
        description: "Свежий движок (сборка 12.2025) — форк Real-ESRGAN, который развивают до сих пор. Пять моделей: универсальная, лёгкая, Remacri и UltraSharp для фото, Digital Art для иллюстраций.",
        url: UPSCAYL.0,
        file: UPSCAYL.1,
        size: UPSCAYL.2,
        bytes: UPSCAYL.3,
        sha256: UPSCAYL.4,
        archive: true,
        extras: UPSCAYL_MODELS,
        marker: UPSCAYL_BIN,
        homepage: "https://github.com/upscayl/upscayl-ncnn",
        license: "AGPL-3.0 (движок) / MIT + CC-BY-NC-SA (модели)",
        tag: "рекомендуем · 2025",
    },
    ModelSpec {
        id: "realesrgan-ncnn",
        name: "Real-ESRGAN (ncnn)",
        category: "upscale",
        description: "Классика (2022). Модели general / anime / anime-video. Проверенный вариант, если Upscayl капризничает на вашей видеокарте.",
        url: REALESRGAN.0,
        file: REALESRGAN.1,
        size: REALESRGAN.2,
        bytes: REALESRGAN.3,
        sha256: REALESRGAN.4,
        archive: true,
        extras: &[],
        marker: REALESRGAN_BIN,
        homepage: "https://github.com/xinntao/Real-ESRGAN",
        license: "BSD-3-Clause",
        tag: "классика",
    },
    ModelSpec {
        id: "waifu2x-ncnn",
        name: "waifu2x (ncnn)",
        category: "upscale",
        description: "Сборка 09.2025. Не «дорисовывает», а бережно чистит и увеличивает — шумодав с регулировкой. Лучший выбор для аниме, лайн-арта и сканов.",
        url: WAIFU2X.0,
        file: WAIFU2X.1,
        size: WAIFU2X.2,
        bytes: WAIFU2X.3,
        sha256: WAIFU2X.4,
        archive: true,
        extras: &[],
        marker: WAIFU2X_BIN,
        homepage: "https://github.com/nihui/waifu2x-ncnn-vulkan",
        license: "MIT",
        tag: "аниме · шумодав",
    },
];

/// Runtime view of a model sent to the frontend.
#[derive(Clone, Serialize)]
pub struct ModelStatus {
    pub id: String,
    pub name: String,
    pub category: String,
    pub description: String,
    pub url: String,
    pub size: String,
    pub homepage: String,
    pub license: String,
    pub tag: String,
    pub downloaded: bool,
    pub path: Option<String>,
}

/// Where models live: the user's override if set, else under app data.
pub fn models_dir(app: &AppHandle) -> Result<PathBuf, String> {
    if let Some(custom) = settings::load(app).models_dir {
        if !custom.trim().is_empty() {
            return Ok(PathBuf::from(custom));
        }
    }
    default_models_dir(app)
}

fn default_models_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| format!("no app data dir: {e}"))?
        .join("models"))
}

/// Where a given spec's primary artifact ends up on disk.
fn target_path(dir: &Path, spec: &ModelSpec) -> PathBuf {
    if spec.archive {
        // Extracted into a per-id folder.
        dir.join(spec.id)
    } else {
        dir.join(spec.file)
    }
}

/// Loose weights live in a predictable subfolder so the engine can be pointed at
/// them with -m regardless of how the archive nests its own directories.
fn extras_dir(dir: &Path, spec: &ModelSpec) -> PathBuf {
    target_path(dir, spec).join("models")
}

/// Recursively check whether a file named `needle` exists under `dir`.
fn contains_file(dir: &Path, needle: &str) -> bool {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return false;
    };
    for e in entries.flatten() {
        let p = e.path();
        if p.is_dir() {
            if contains_file(&p, needle) {
                return true;
            }
        } else if p.file_name().and_then(|n| n.to_str()) == Some(needle) {
            return true;
        }
    }
    false
}

fn is_downloaded(dir: &Path, spec: &ModelSpec) -> bool {
    let p = target_path(dir, spec);
    if !spec.archive {
        return p.is_file();
    }
    let base_ok = if spec.marker.is_empty() {
        p.is_dir()
            && std::fs::read_dir(&p)
                .map(|mut d| d.next().is_some())
                .unwrap_or(false)
    } else {
        contains_file(&p, spec.marker)
    };
    if !base_ok {
        return false;
    }
    // A half-finished extras download must not read as installed.
    let ex = extras_dir(dir, spec);
    spec.extras.iter().all(|(_, name, _, _)| ex.join(name).is_file())
}

#[tauri::command]
pub fn list_models(app: AppHandle) -> Result<Vec<ModelStatus>, String> {
    let dir = models_dir(&app)?;
    let out = REGISTRY
        .iter()
        .map(|spec| {
            let downloaded = is_downloaded(&dir, spec);
            let path = if downloaded {
                Some(target_path(&dir, spec).to_string_lossy().to_string())
            } else {
                None
            };
            ModelStatus {
                id: spec.id.to_string(),
                name: spec.name.to_string(),
                category: spec.category.to_string(),
                description: spec.description.to_string(),
                url: spec.url.to_string(),
                size: spec.size.to_string(),
                homepage: spec.homepage.to_string(),
                license: spec.license.to_string(),
                tag: spec.tag.to_string(),
                downloaded,
                path,
            }
        })
        .collect();
    Ok(out)
}

#[derive(Clone, Serialize)]
struct Progress {
    id: String,
    downloaded: u64,
    total: u64,
    phase: String, // "download" | "extract" | "done"
}

/// Stream `url` to `dest`, emitting progress offset by `done_before` so a
/// multi-file download reads as one continuous bar.
async fn fetch_to_file(
    app: &AppHandle,
    client: &reqwest::Client,
    id: &str,
    url: &str,
    dest: &Path,
    done_before: u64,
    grand_total: u64,
) -> Result<u64, String> {
    let resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("request failed: {e}"))?
        .error_for_status()
        .map_err(|e| format!("bad status: {e}"))?;

    let mut file = tokio::fs::File::create(dest)
        .await
        .map_err(|e| format!("create failed: {e}"))?;

    let mut got: u64 = 0;
    let mut last_emit = 0u64;
    let mut stream = resp.bytes_stream();
    while let Some(chunk) = stream.next().await {
        if cancel_requested(id) {
            return Err(CANCEL_MARKER.into());
        }
        let chunk = chunk.map_err(|e| format!("stream error: {e}"))?;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("write error: {e}"))?;
        got += chunk.len() as u64;
        // Throttle events to ~every 512 KB.
        if got - last_emit > 512 * 1024 {
            last_emit = got;
            let _ = app.emit(
                "model:progress",
                Progress {
                    id: id.to_string(),
                    downloaded: (done_before + got).min(grand_total),
                    total: grand_total,
                    phase: "download".into(),
                },
            );
        }
    }
    file.flush().await.map_err(|e| e.to_string())?;
    Ok(got)
}

/// Hex SHA-256 of a file, streamed so a 1 GB model never lands in memory.
fn sha256_file(path: &Path) -> Result<String, String> {
    use sha2::{Digest, Sha256};
    let mut f = std::fs::File::open(path).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    std::io::copy(&mut f, &mut hasher).map_err(|e| e.to_string())?;
    Ok(format!("{:x}", hasher.finalize()))
}

/// Fail the download unless `path` hashes to `expected`. An empty `expected`
/// skips the check (nothing in the registry ships unpinned, but keeping this
/// tolerant means a locally added entry still works).
async fn verify_sha256(path: &Path, expected: &str, what: &str) -> Result<(), String> {
    if expected.is_empty() {
        return Ok(());
    }
    let p = path.to_path_buf();
    let got = tokio::task::spawn_blocking(move || sha256_file(&p))
        .await
        .map_err(|e| e.to_string())??;
    if !got.eq_ignore_ascii_case(expected) {
        return Err(format!(
            "Контрольная сумма не совпала для {what}.\nОжидалось: {expected}\nПолучено:  {got}\n\
             Файл повреждён или подменён — загрузка удалена. Попробуйте ещё раз."
        ));
    }
    Ok(())
}

/// Remove any half-written files left by an aborted or failed download so the
/// model doesn't read as installed and disk isn't left with dead .part files.
async fn cleanup_partial(dir: &Path, spec: &ModelSpec) {
    let tmp = dir.join(format!("{}.part", spec.file));
    let _ = tokio::fs::remove_file(&tmp).await;
    if spec.archive {
        // The per-id folder holds the extraction plus any extras (and their
        // .part files) — drop the whole thing.
        let _ = tokio::fs::remove_dir_all(target_path(dir, spec)).await;
    }
}

#[tauri::command]
pub async fn download_model(app: AppHandle, id: String) -> Result<(), String> {
    let spec = REGISTRY
        .iter()
        .find(|s| s.id == id)
        .ok_or_else(|| format!("unknown model: {id}"))?;

    // Drop any stale cancel flag from a previous run before we start.
    clear_cancel(&id);
    let dir = models_dir(&app)?;

    let res = download_inner(&app, spec, &dir, &id).await;
    match res {
        Ok(()) => {
            clear_cancel(&id);
            Ok(())
        }
        Err(e) => {
            cleanup_partial(&dir, spec).await;
            clear_cancel(&id);
            if e == CANCEL_MARKER {
                // Tell the UI to drop the progress bar; not an error to surface.
                let _ = app.emit(
                    "model:progress",
                    Progress {
                        id: id.clone(),
                        downloaded: 0,
                        total: 0,
                        phase: "cancelled".into(),
                    },
                );
                Ok(())
            } else {
                Err(e)
            }
        }
    }
}

async fn download_inner(
    app: &AppHandle,
    spec: &ModelSpec,
    dir: &Path,
    id: &str,
) -> Result<(), String> {
    tokio::fs::create_dir_all(dir)
        .await
        .map_err(|e| format!("mkdir failed: {e}"))?;

    let client = reqwest::Client::builder()
        .user_agent("lil-edit/0.1")
        .build()
        .map_err(|e| e.to_string())?;

    let extras_bytes: u64 = spec.extras.iter().map(|(_, _, b, _)| b).sum();
    let grand_total = spec.bytes + extras_bytes;

    let tmp = dir.join(format!("{}.part", spec.file));
    let got = fetch_to_file(app, &client, id, spec.url, &tmp, 0, grand_total).await?;
    // Check the bytes before anything touches them: an archive is about to be
    // unpacked and its binary made executable.
    verify_sha256(&tmp, spec.sha256, spec.file).await?;
    let mut done = got;

    if spec.archive {
        let _ = app.emit(
            "model:progress",
            Progress {
                id: id.to_string(),
                downloaded: done.min(grand_total),
                total: grand_total,
                phase: "extract".into(),
            },
        );
        let out_dir = target_path(dir, spec);
        let tmp_clone = tmp.clone();
        let out_clone = out_dir.clone();
        // zip crate is sync; run on a blocking thread.
        tokio::task::spawn_blocking(move || extract_zip(&tmp_clone, &out_clone))
            .await
            .map_err(|e| e.to_string())?
            .map_err(|e| format!("extract failed: {e}"))?;
        let _ = tokio::fs::remove_file(&tmp).await;

        if !spec.extras.is_empty() {
            let ex_dir = extras_dir(dir, spec);
            tokio::fs::create_dir_all(&ex_dir)
                .await
                .map_err(|e| format!("mkdir failed: {e}"))?;
            for (url, name, _, sha) in spec.extras {
                // Download beside the final name, then rename — an interrupted
                // run leaves a .part behind instead of a truncated weight file
                // that would read as installed.
                let part = ex_dir.join(format!("{name}.part"));
                let n = fetch_to_file(app, &client, id, url, &part, done, grand_total).await?;
                verify_sha256(&part, sha, name).await?;
                tokio::fs::rename(&part, ex_dir.join(name))
                    .await
                    .map_err(|e| format!("rename failed: {e}"))?;
                done += n;
            }
        }
    } else {
        let final_path = dir.join(spec.file);
        tokio::fs::rename(&tmp, &final_path)
            .await
            .map_err(|e| format!("rename failed: {e}"))?;
    }

    let _ = app.emit(
        "model:progress",
        Progress {
            id: id.to_string(),
            downloaded: grand_total,
            total: grand_total,
            phase: "done".into(),
        },
    );
    Ok(())
}

fn extract_zip(zip_path: &Path, out_dir: &Path) -> Result<(), String> {
    let f = std::fs::File::open(zip_path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(f).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(out_dir).map_err(|e| e.to_string())?;
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        // Use the zip's own path, but guard against path traversal.
        let rel = match entry.enclosed_name() {
            Some(p) => p,
            None => continue,
        };
        if rel.as_os_str().is_empty() {
            continue;
        }
        let dest = out_dir.join(&rel);
        if entry.is_dir() {
            std::fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
            continue;
        }
        if let Some(parent) = dest.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let mut out = std::fs::File::create(&dest).map_err(|e| e.to_string())?;
        std::io::copy(&mut entry, &mut out).map_err(|e| e.to_string())?;
        // Preserve exec bit on unix (the ncnn binary needs it).
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Some(mode) = entry.unix_mode() {
                let _ = std::fs::set_permissions(&dest, std::fs::Permissions::from_mode(mode));
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub fn delete_model(app: AppHandle, id: String) -> Result<(), String> {
    let spec = REGISTRY
        .iter()
        .find(|s| s.id == id)
        .ok_or_else(|| format!("unknown model: {id}"))?;
    let dir = models_dir(&app)?;
    let p = target_path(&dir, spec);
    if spec.archive {
        if p.is_dir() {
            std::fs::remove_dir_all(&p).map_err(|e| e.to_string())?;
        }
    } else if p.is_file() {
        std::fs::remove_file(&p).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn models_dir_path(app: AppHandle) -> Result<String, String> {
    let dir = models_dir(&app)?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.to_string_lossy().to_string())
}

/// Recursively sum the byte size of every file under `dir`.
fn dir_size(dir: &Path) -> u64 {
    let mut total = 0u64;
    if let Ok(entries) = std::fs::read_dir(dir) {
        for e in entries.flatten() {
            let p = e.path();
            if p.is_dir() {
                total += dir_size(&p);
            } else if let Ok(md) = e.metadata() {
                total += md.len();
            }
        }
    }
    total
}

#[derive(Clone, Serialize)]
pub struct CacheInfo {
    pub dir: String,
    /// Total bytes on disk under the models dir (includes any stray .part files).
    pub bytes: u64,
    /// Number of registry models currently installed.
    pub installed: usize,
}

#[tauri::command]
pub fn cache_info(app: AppHandle) -> Result<CacheInfo, String> {
    let dir = models_dir(&app)?;
    let bytes = if dir.is_dir() { dir_size(&dir) } else { 0 };
    let installed = REGISTRY.iter().filter(|s| is_downloaded(&dir, s)).count();
    Ok(CacheInfo {
        dir: dir.to_string_lossy().to_string(),
        bytes,
        installed,
    })
}

/// Delete every downloaded model + any leftover temp files. The directory
/// itself is kept so the app can immediately download again.
#[tauri::command]
pub fn clear_cache(app: AppHandle) -> Result<u64, String> {
    let dir = models_dir(&app)?;
    if !dir.is_dir() {
        return Ok(0);
    }
    let freed = dir_size(&dir);
    for entry in std::fs::read_dir(&dir).map_err(|e| e.to_string())?.flatten() {
        let p = entry.path();
        let res = if p.is_dir() {
            std::fs::remove_dir_all(&p)
        } else {
            std::fs::remove_file(&p)
        };
        res.map_err(|e| format!("не удалось удалить {}: {e}", p.display()))?;
    }
    Ok(freed)
}

// ---------------------------------------------------------------------------
// Where the models live
// ---------------------------------------------------------------------------

#[derive(Clone, Serialize)]
pub struct ModelsLocation {
    /// The folder in use right now.
    pub dir: String,
    /// The built-in location (under app data).
    pub default_dir: String,
    /// A "models" folder next to the executable — the portable option. `None`
    /// when the install directory isn't writable (e.g. Program Files).
    pub app_dir: Option<String>,
    /// True when `dir` is a user override rather than the default.
    pub custom: bool,
    pub bytes: u64,
}

/// A "models" folder beside the executable, if we could actually write there.
fn app_side_dir() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let parent = exe.parent()?;
    // macOS puts the binary inside …/Contents/MacOS — writing there would break
    // the bundle signature, so the portable option is Windows/Linux only.
    if cfg!(target_os = "macos") {
        return None;
    }
    if !is_writable(parent) {
        return None;
    }
    Some(parent.join("models"))
}

/// Best-effort writability probe — creates the folder and a throwaway file.
fn is_writable(dir: &Path) -> bool {
    if std::fs::create_dir_all(dir).is_err() {
        return false;
    }
    let probe = dir.join(".lil-edit-write-test");
    match std::fs::write(&probe, b"") {
        Ok(_) => {
            let _ = std::fs::remove_file(&probe);
            true
        }
        Err(_) => false,
    }
}

#[tauri::command]
pub fn models_location(app: AppHandle) -> Result<ModelsLocation, String> {
    let dir = models_dir(&app)?;
    let default_dir = default_models_dir(&app)?;
    Ok(ModelsLocation {
        bytes: if dir.is_dir() { dir_size(&dir) } else { 0 },
        custom: dir != default_dir,
        dir: dir.to_string_lossy().to_string(),
        default_dir: default_dir.to_string_lossy().to_string(),
        app_dir: app_side_dir().map(|p| p.to_string_lossy().to_string()),
    })
}

/// Move every entry of `from` into `to`. Falls back to copy+delete because a
/// plain rename fails across drives — which is exactly the case people hit
/// when they move models off C:.
fn move_dir_contents(from: &Path, to: &Path) -> Result<(), String> {
    std::fs::create_dir_all(to).map_err(|e| format!("mkdir failed: {e}"))?;
    for entry in std::fs::read_dir(from).map_err(|e| e.to_string())?.flatten() {
        let src = entry.path();
        let Some(name) = src.file_name() else { continue };
        let dst = to.join(name);
        if std::fs::rename(&src, &dst).is_ok() {
            continue;
        }
        if src.is_dir() {
            copy_dir(&src, &dst)?;
            std::fs::remove_dir_all(&src).map_err(|e| e.to_string())?;
        } else {
            std::fs::copy(&src, &dst).map_err(|e| format!("copy failed: {e}"))?;
            std::fs::remove_file(&src).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn copy_dir(from: &Path, to: &Path) -> Result<(), String> {
    std::fs::create_dir_all(to).map_err(|e| e.to_string())?;
    for entry in std::fs::read_dir(from).map_err(|e| e.to_string())?.flatten() {
        let src = entry.path();
        let Some(name) = src.file_name() else { continue };
        let dst = to.join(name);
        if src.is_dir() {
            copy_dir(&src, &dst)?;
        } else {
            std::fs::copy(&src, &dst).map_err(|e| format!("copy failed: {e}"))?;
            // Keep the exec bit — the engine binaries live in here.
            #[cfg(unix)]
            if let Ok(md) = std::fs::metadata(&src) {
                let _ = std::fs::set_permissions(&dst, md.permissions());
            }
        }
    }
    Ok(())
}

/// Point the models folder somewhere else. `dir: None` restores the default.
/// With `move_existing`, whatever is already downloaded is carried over.
#[tauri::command]
pub fn set_models_dir(
    app: AppHandle,
    dir: Option<String>,
    move_existing: bool,
) -> Result<ModelsLocation, String> {
    let current = models_dir(&app)?;
    let target = match dir.as_deref().map(str::trim) {
        None | Some("") => default_models_dir(&app)?,
        Some(d) => PathBuf::from(d),
    };

    if target == current {
        return models_location(app);
    }
    // Refuse to nest the new folder inside the old one: the move would walk into
    // its own destination. Checked before the write probe so a bad pick doesn't
    // leave a stray folder behind.
    if target.starts_with(&current) {
        return Err("Новая папка находится внутри старой — выберите другую.".into());
    }
    if !is_writable(&target) {
        return Err(format!(
            "Нет доступа на запись в {}. Выберите другую папку.",
            target.display()
        ));
    }

    if move_existing && current.is_dir() {
        move_dir_contents(&current, &target)?;
        // Leave the (now empty) default in place; a custom folder we created is
        // ours to clean up.
        let _ = std::fs::remove_dir(&current);
    }

    let mut s = settings::load(&app);
    s.models_dir = if dir.as_deref().map(str::trim).unwrap_or("").is_empty() {
        None
    } else {
        Some(target.to_string_lossy().to_string())
    };
    settings::store(&app, &s)?;
    models_location(app)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn is_sha256(s: &str) -> bool {
        s.len() == 64 && s.bytes().all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())
    }

    /// Every artifact we download must be pinned. `verify_sha256` tolerates an
    /// empty hash so a locally added entry still works, which means nothing but
    /// this test stops an unpinned entry from shipping — these are executables.
    #[test]
    fn every_registry_entry_is_pinned() {
        for spec in REGISTRY {
            assert!(
                is_sha256(spec.sha256),
                "{}: sha256 missing or malformed ({:?})",
                spec.id,
                spec.sha256
            );
            for (_, name, _, sha) in spec.extras {
                assert!(
                    is_sha256(sha),
                    "{}/{name}: sha256 missing or malformed ({sha:?})",
                    spec.id
                );
            }
        }
    }

    /// A wrong hash has to fail, or the check is decoration.
    #[tokio::test]
    async fn verify_rejects_a_mismatch_and_accepts_a_match() {
        let dir = std::env::temp_dir().join("lil-edit-sha-test");
        std::fs::create_dir_all(&dir).unwrap();
        let f = dir.join("probe.bin");
        std::fs::write(&f, b"lil edit").unwrap();
        let real = sha256_file(&f).unwrap();

        assert!(verify_sha256(&f, &real, "probe").await.is_ok());
        // Case-insensitive, since hashes get pasted from all sorts of places.
        assert!(verify_sha256(&f, &real.to_uppercase(), "probe").await.is_ok());
        assert!(verify_sha256(&f, &"0".repeat(64), "probe").await.is_err());
        // An empty pin is the documented escape hatch.
        assert!(verify_sha256(&f, "", "probe").await.is_ok());
        let _ = std::fs::remove_file(&f);
    }
}

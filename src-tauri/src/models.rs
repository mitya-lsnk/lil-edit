// Model registry + downloader for background-removal (ONNX) and upscale (ncnn) assets.
//
// Everything is stored under <app_data_dir>/models. Each entry either lands as a
// single file (e.g. an .onnx) or, when `archive` is true, is downloaded as a .zip
// and extracted into <models>/<id>/.

use std::path::{Path, PathBuf};

use futures_util::StreamExt;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::AsyncWriteExt;

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
    /// If true, `file` is a zip that gets extracted into <models>/<id>/.
    pub archive: bool,
    /// Project / source page for reference.
    pub homepage: &'static str,
    /// License note.
    pub license: &'static str,
    /// Short quality/speed tag shown as a badge (e.g. "SOTA", "быстрая").
    pub tag: &'static str,
}

/// The full registry. Links verified reachable on 2026-07-19.
pub const REGISTRY: &[ModelSpec] = &[
    ModelSpec {
        id: "birefnet",
        name: "BiRefNet",
        category: "background",
        description: "State-of-the-art (2024). The cleanest edges — hair, fur, fine detail. Large & slower, best quality.",
        url: "https://huggingface.co/onnx-community/BiRefNet-ONNX/resolve/main/onnx/model.onnx",
        file: "birefnet.onnx",
        size: "928 MB",
        bytes: 972_666_916,
        archive: false,
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
        size: "4.4 MB",
        bytes: 4_574_861,
        archive: false,
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
        size: "168 MB",
        bytes: 175_997_641,
        archive: false,
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
        size: "170 MB",
        bytes: 178_648_008,
        archive: false,
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
        size: "42 MB",
        bytes: 44_173_029,
        archive: false,
        homepage: "https://github.com/danielgatis/rembg",
        license: "Apache-2.0 (rembg)",
        tag: "компактная",
    },
    ModelSpec {
        id: "realesrgan-ncnn",
        name: "Real-ESRGAN (ncnn)",
        category: "upscale",
        description: "Upscale engine + models (general, anime, anime-video). GPU-accelerated via Vulkan.",
        url: "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-macos.zip",
        file: "realesrgan-ncnn-vulkan-macos.zip",
        size: "49 MB",
        bytes: 51_817_124,
        archive: true,
        homepage: "https://github.com/xinntao/Real-ESRGAN",
        license: "BSD-3-Clause",
        tag: "GPU · Vulkan",
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

fn models_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("no app data dir: {e}"))?
        .join("models");
    Ok(dir)
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

fn is_downloaded(dir: &Path, spec: &ModelSpec) -> bool {
    let p = target_path(dir, spec);
    if spec.archive {
        p.is_dir() && std::fs::read_dir(&p).map(|mut d| d.next().is_some()).unwrap_or(false)
    } else {
        p.is_file()
    }
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

#[tauri::command]
pub async fn download_model(app: AppHandle, id: String) -> Result<(), String> {
    let spec = REGISTRY
        .iter()
        .find(|s| s.id == id)
        .ok_or_else(|| format!("unknown model: {id}"))?;

    let dir = models_dir(&app)?;
    tokio::fs::create_dir_all(&dir)
        .await
        .map_err(|e| format!("mkdir failed: {e}"))?;

    let tmp = dir.join(format!("{}.part", spec.file));
    let client = reqwest::Client::builder()
        .user_agent("im-mage/0.1")
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .get(spec.url)
        .send()
        .await
        .map_err(|e| format!("request failed: {e}"))?
        .error_for_status()
        .map_err(|e| format!("bad status: {e}"))?;

    let total = resp.content_length().unwrap_or(spec.bytes);
    let mut file = tokio::fs::File::create(&tmp)
        .await
        .map_err(|e| format!("create tmp failed: {e}"))?;

    let mut downloaded: u64 = 0;
    let mut stream = resp.bytes_stream();
    let mut last_emit = 0u64;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("stream error: {e}"))?;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("write error: {e}"))?;
        downloaded += chunk.len() as u64;
        // Throttle events to ~every 512 KB.
        if downloaded - last_emit > 512 * 1024 {
            last_emit = downloaded;
            let _ = app.emit(
                "model:progress",
                Progress {
                    id: id.clone(),
                    downloaded,
                    total,
                    phase: "download".into(),
                },
            );
        }
    }
    file.flush().await.map_err(|e| e.to_string())?;
    drop(file);

    if spec.archive {
        let _ = app.emit(
            "model:progress",
            Progress {
                id: id.clone(),
                downloaded,
                total,
                phase: "extract".into(),
            },
        );
        let out_dir = dir.join(spec.id);
        let tmp_clone = tmp.clone();
        let out_clone = out_dir.clone();
        // zip crate is sync; run on a blocking thread.
        tokio::task::spawn_blocking(move || extract_zip(&tmp_clone, &out_clone))
            .await
            .map_err(|e| e.to_string())?
            .map_err(|e| format!("extract failed: {e}"))?;
        let _ = tokio::fs::remove_file(&tmp).await;
    } else {
        let final_path = dir.join(spec.file);
        tokio::fs::rename(&tmp, &final_path)
            .await
            .map_err(|e| format!("rename failed: {e}"))?;
    }

    let _ = app.emit(
        "model:progress",
        Progress {
            id: id.clone(),
            downloaded: total,
            total,
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

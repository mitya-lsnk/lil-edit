// AI image ops that shell out to native tooling.
//
// upscale_image runs one of the ncnn-vulkan engines downloaded by the model
// manager (Upscayl, Real-ESRGAN or waifu2x). remove_background is implemented in
// bg.rs (ONNX via `ort`).

use std::path::{Path, PathBuf};
use std::process::Command;

use tauri::ipc::{Request, Response};
use tauri::AppHandle;

use crate::ipcx;
use crate::models::{self, REALESRGAN_BIN, UPSCAYL_BIN, WAIFU2X_BIN};

/// How an engine wants to be called. The two Real-ESRGAN lineages share a CLI;
/// waifu2x names its models by folder and takes a separate denoise level.
enum Cli {
    /// -n <model name>, models looked up inside one shared folder.
    Esrgan,
    /// -m <models-{variant}> folder, -n <denoise level>.
    Waifu2x,
}

struct Engine {
    /// Registry id — also the folder name under <models>/.
    id: &'static str,
    bin: &'static str,
    cli: Cli,
}

const ENGINES: &[Engine] = &[
    Engine {
        id: "upscayl-ncnn",
        bin: UPSCAYL_BIN,
        cli: Cli::Esrgan,
    },
    Engine {
        id: "realesrgan-ncnn",
        bin: REALESRGAN_BIN,
        cli: Cli::Esrgan,
    },
    Engine {
        id: "waifu2x-ncnn",
        bin: WAIFU2X_BIN,
        cli: Cli::Waifu2x,
    },
];

/// Recursively find the first file whose name matches `needle`.
fn find_file(dir: &Path, needle: &str) -> Option<PathBuf> {
    let entries = std::fs::read_dir(dir).ok()?;
    for e in entries.flatten() {
        let p = e.path();
        if p.is_dir() {
            if let Some(found) = find_file(&p, needle) {
                return Some(found);
            }
        } else if p.file_name().and_then(|n| n.to_str()) == Some(needle) {
            return Some(p);
        }
    }
    None
}

/// Recursively find a directory by name (waifu2x's models-* folders).
fn find_dir(dir: &Path, needle: &str) -> Option<PathBuf> {
    let entries = std::fs::read_dir(dir).ok()?;
    let mut subdirs = vec![];
    for e in entries.flatten() {
        let p = e.path();
        if p.is_dir() {
            if p.file_name().and_then(|n| n.to_str()) == Some(needle) {
                return Some(p);
            }
            subdirs.push(p);
        }
    }
    subdirs.into_iter().find_map(|s| find_dir(&s, needle))
}

/// Find the directory that holds the ncnn model files (*.param).
fn find_models_dir(dir: &Path) -> Option<PathBuf> {
    let entries = std::fs::read_dir(dir).ok()?;
    let mut subdirs = vec![];
    for e in entries.flatten() {
        let p = e.path();
        if p.is_dir() {
            subdirs.push(p);
        } else if p.extension().and_then(|x| x.to_str()) == Some("param") {
            return Some(dir.to_path_buf());
        }
    }
    for s in subdirs {
        if let Some(found) = find_models_dir(&s) {
            return Some(found);
        }
    }
    None
}

/// Takes the image as a raw IPC body (an ArrayBuffer from JS) with the knobs in
/// headers, and returns raw bytes. Passing pixels as a JSON array of numbers —
/// which is what a `Vec<u8>` argument/return does — boxed every byte and spiked
/// peak memory to several times the file size in each direction.
#[tauri::command]
pub async fn upscale_image(app: AppHandle, request: Request<'_>) -> Result<Response, String> {
    let image = ipcx::raw_body(&request)?;
    let engine = ipcx::header(&request, "x-engine")?;
    let model_name = ipcx::header(&request, "x-model")?;
    let scale: u32 = ipcx::header(&request, "x-scale")?
        .parse()
        .map_err(|_| "bad scale".to_string())?;
    let denoise: i32 = ipcx::header(&request, "x-denoise")?
        .parse()
        .map_err(|_| "bad denoise".to_string())?;

    let eng = ENGINES
        .iter()
        .find(|e| e.id == engine)
        .ok_or_else(|| format!("неизвестный движок: {engine}"))?;

    let root = models::models_dir(&app)?.join(eng.id);
    if !root.is_dir() {
        return Err("Движок не установлен. Скачайте его в разделе «Движки апскейла».".into());
    }

    let bin = find_file(&root, eng.bin)
        .ok_or_else(|| format!("Не найден бинарник {} в папке движка", eng.bin))?;
    let workdir = bin.parent().unwrap_or(&root).to_path_buf();

    // Ensure it's runnable and not quarantined (best-effort).
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&bin, std::fs::Permissions::from_mode(0o755));
    }
    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("xattr")
            .args(["-dr", "com.apple.quarantine"])
            .arg(&root)
            .output();
    }

    // Temp in/out files.
    let tmp = std::env::temp_dir();
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let in_path = tmp.join(format!("lil-image-in-{stamp}"));
    let out_path = tmp.join(format!("lil-image-out-{stamp}.png"));

    // ncnn reads the file itself and ignores EXIF orientation, so a photo shot
    // sideways came back rotated away from the original it sits next to. Only
    // pay for a decode+re-encode when the tag actually asks for a transform;
    // otherwise hand the engine the original bytes untouched.
    match crate::imgx::orientation_of(&image) {
        image::metadata::Orientation::NoTransforms => {
            std::fs::write(&in_path, &image).map_err(|e| format!("temp write failed: {e}"))?;
        }
        _ => {
            let (img, _) = crate::imgx::decode_oriented(&image)?;
            img.save_with_format(&in_path, image::ImageFormat::Png)
                .map_err(|e| format!("temp write failed: {e}"))?;
        }
    }

    let mut cmd = Command::new(&bin);
    cmd.current_dir(&workdir)
        .arg("-i")
        .arg(&in_path)
        .arg("-o")
        .arg(&out_path)
        .arg("-s")
        .arg(scale.to_string())
        .arg("-f")
        .arg("png");

    match eng.cli {
        Cli::Esrgan => {
            // Upscayl keeps its weights in the folder we downloaded them into;
            // Real-ESRGAN ships them inside the archive, so go looking.
            let models_dir = if eng.id == "upscayl-ncnn" {
                root.join("models")
            } else {
                find_models_dir(&root)
                    .ok_or("Не найдена папка с моделями (.param) внутри движка")?
            };
            // The anime-video model ships one file per scale (…-x2/-x3/-x4).
            let effective = if model_name == "realesr-animevideov3" {
                format!("realesr-animevideov3-x{scale}")
            } else {
                model_name.clone()
            };
            cmd.arg("-n").arg(&effective).arg("-m").arg(&models_dir);
        }
        Cli::Waifu2x => {
            // Here -n is the denoise level and the model is chosen by folder.
            let models_dir = find_dir(&root, &model_name)
                .ok_or_else(|| format!("Не найдена папка модели {model_name}"))?;
            cmd.arg("-n")
                .arg(denoise.to_string())
                .arg("-m")
                .arg(&models_dir);
        }
    }

    // Don't flash a console window on each run (the engine is a console app).
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let output = cmd
        .output()
        .map_err(|e| format!("Не удалось запустить движок: {e}"))?;

    let _ = std::fs::remove_file(&in_path);

    if !out_path.exists() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "Апскейл не создал файл. Вывод движка:\n{}",
            stderr.trim()
        ));
    }
    let bytes = std::fs::read(&out_path).map_err(|e| e.to_string())?;
    let _ = std::fs::remove_file(&out_path);
    Ok(Response::new(bytes))
}

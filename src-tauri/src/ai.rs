// AI image ops that shell out to native tooling.
//
// upscale_image runs the Real-ESRGAN ncnn-vulkan binary (downloaded via the model
// manager). remove_background is implemented in bg.rs (ONNX via `ort`).

use std::path::{Path, PathBuf};
use std::process::Command;

use tauri::{AppHandle, Manager};

fn models_root(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("models"))
}

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

#[tauri::command]
pub async fn upscale_image(
    app: AppHandle,
    image: Vec<u8>,
    scale: u32,
    model_name: String,
) -> Result<Vec<u8>, String> {
    let root = models_root(&app)?.join("realesrgan-ncnn");
    if !root.is_dir() {
        return Err("Движок Real-ESRGAN не установлен. Скачайте его в разделе «Движок апскейла».".into());
    }

    let bin = find_file(&root, "realesrgan-ncnn-vulkan")
        .ok_or("Не найден бинарник realesrgan-ncnn-vulkan в папке модели")?;
    let models_dir = find_models_dir(&root)
        .ok_or("Не найдена папка с моделями (.param) внутри движка")?;
    let workdir = bin.parent().unwrap_or(&root).to_path_buf();

    // Ensure it's runnable and not quarantined (best-effort).
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&bin, std::fs::Permissions::from_mode(0o755));
    }
    let _ = Command::new("xattr")
        .args(["-dr", "com.apple.quarantine"])
        .arg(&root)
        .output();

    // Temp in/out files.
    let tmp = std::env::temp_dir();
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let in_path = tmp.join(format!("immage-in-{stamp}"));
    let out_path = tmp.join(format!("immage-out-{stamp}.png"));
    std::fs::write(&in_path, &image).map_err(|e| format!("temp write failed: {e}"))?;

    // The anime-video model ships one file per scale (…-x2/-x3/-x4).
    let effective_model = if model_name == "realesr-animevideov3" {
        format!("realesr-animevideov3-x{scale}")
    } else {
        model_name.clone()
    };

    let output = Command::new(&bin)
        .current_dir(&workdir)
        .arg("-i")
        .arg(&in_path)
        .arg("-o")
        .arg(&out_path)
        .arg("-s")
        .arg(scale.to_string())
        .arg("-n")
        .arg(&effective_model)
        .arg("-m")
        .arg(&models_dir)
        .arg("-f")
        .arg("png")
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
    Ok(bytes)
}

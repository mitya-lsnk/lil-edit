// File I/O for paths the user picked themselves (drag-drop, open/save dialogs).
//
// Deliberately not the fs plugin: its capability scope is anchored to $HOME, so a
// picture on D:\ — the normal case for the people testing this — can be neither
// read nor written through it. These two commands take a path the user already
// chose in a native dialog or a drop, and do exactly that one thing.

use std::path::Path;

use tauri::ipc::Response;

/// Cap on what we'll pull into the webview as a single image.
const MAX_BYTES: u64 = 512 * 1024 * 1024;

/// Returns an `ipc::Response` so the bytes cross as a raw ArrayBuffer. A plain
/// `Vec<u8>` would be serialized as a JSON array of numbers, and this runs on
/// every dropped file.
#[tauri::command]
pub fn read_file_bytes(path: String) -> Result<Response, String> {
    let p = Path::new(&path);
    let md = std::fs::metadata(p).map_err(|e| format!("{path}: {e}"))?;
    if !md.is_file() {
        return Err(format!("{path}: не файл"));
    }
    if md.len() > MAX_BYTES {
        return Err("Файл слишком большой".into());
    }
    let bytes = std::fs::read(p).map_err(|e| format!("{path}: {e}"))?;
    Ok(Response::new(bytes))
}

#[tauri::command]
pub fn write_file_bytes(path: String, data: Vec<u8>) -> Result<(), String> {
    let p = Path::new(&path);
    if let Some(parent) = p.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("{}: {e}", parent.display()))?;
    }
    std::fs::write(p, &data).map_err(|e| format!("{path}: {e}"))
}

/// Image extensions the batch queue picks up from a folder.
const IMAGE_EXTS: &[&str] = &[
    "png", "jpg", "jpeg", "webp", "avif", "gif", "bmp", "tif", "tiff",
];

/// List image files directly inside `dir` (non-recursive), sorted by name.
/// Returns full paths. Used by batch processing to enqueue a whole folder.
#[tauri::command]
pub fn list_dir_images(dir: String) -> Result<Vec<String>, String> {
    let entries = std::fs::read_dir(&dir).map_err(|e| format!("{dir}: {e}"))?;
    let mut out: Vec<String> = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let ext_ok = path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| IMAGE_EXTS.contains(&e.to_lowercase().as_str()))
            .unwrap_or(false);
        if ext_ok {
            if let Some(s) = path.to_str() {
                out.push(s.to_string());
            }
        }
    }
    out.sort();
    Ok(out)
}

mod ai;
mod bg;
mod fsx;
mod imgx;
mod ipcx;
mod models;
mod settings;
mod update;

/// Files another app (or Finder) asked us to open before the webview was ready.
///
/// A cold launch delivers `RunEvent::Opened` while React is still mounting, so
/// the paths have to wait somewhere. The frontend drains this on mount and
/// listens for `open-files` afterwards. Without the buffer, "Open in lil edit"
/// from lil view would start the app on an empty screen.
#[derive(Default)]
struct PendingOpen(std::sync::Mutex<Vec<String>>);

#[tauri::command]
fn take_pending_open(state: tauri::State<'_, PendingOpen>) -> Vec<String> {
    std::mem::take(&mut *state.0.lock().unwrap())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            models::list_models,
            models::download_model,
            models::cancel_download,
            models::delete_model,
            models::models_dir_path,
            models::models_location,
            models::set_models_dir,
            models::cache_info,
            models::clear_cache,
            fsx::read_file_bytes,
            fsx::write_file_bytes,
            fsx::list_dir_images,
            ai::upscale_image,
            bg::remove_background,
            update::check_update,
            take_pending_open,
        ])
        .manage(PendingOpen::default())
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    // `build` + `run` rather than the one-shot `run()`: `RunEvent` is the only
    // place macOS delivers "open these documents".
    //
    // `RunEvent::Opened` exists only on macOS and iOS — it is not a variant at
    // all elsewhere, so the arm has to be compiled out rather than just left
    // unmatched, or the Windows build fails to compile.
    app.run(|_app, _event| {
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Opened { urls } = _event {
            use tauri::{Emitter, Manager};
            let paths: Vec<String> = urls
                .iter()
                .filter_map(|u| u.to_file_path().ok())
                .map(|p| p.to_string_lossy().to_string())
                .collect();
            if paths.is_empty() {
                return;
            }
            _app.state::<PendingOpen>()
                .0
                .lock()
                .unwrap()
                .extend(paths.iter().cloned());
            let _ = _app.emit("open-files", paths);
        }
    });
}

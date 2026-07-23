mod ai;
mod bg;
mod models;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            models::list_models,
            models::download_model,
            models::delete_model,
            models::models_dir_path,
            models::cache_info,
            models::clear_cache,
            ai::upscale_image,
            bg::remove_background,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

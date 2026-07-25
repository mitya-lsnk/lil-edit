mod ai;
mod bg;
mod fsx;
mod models;
mod settings;

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
            models::models_location,
            models::set_models_dir,
            models::cache_info,
            models::clear_cache,
            fsx::read_file_bytes,
            fsx::write_file_bytes,
            fsx::list_dir_images,
            ai::upscale_image,
            bg::remove_background,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

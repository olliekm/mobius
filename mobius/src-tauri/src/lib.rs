use tauri::Manager;
use tauri::webview::Color;

#[tauri::command]
fn show_window(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![show_window])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            // Set background to match app theme (#0d0d0d) to prevent white flash
            let _ = window.set_background_color(Some(Color(13, 13, 13, 255)));
            window_vibrancy::apply_vibrancy(&window, window_vibrancy::NSVisualEffectMaterial::UnderWindowBackground, None, None)
                .expect("Unsupported platform! 'apply_vibrancy' is only supported on macOS");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

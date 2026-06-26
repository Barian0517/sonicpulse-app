mod audio;

use std::fs::File;
use std::io::Write;

#[tauri::command]
async fn download_file(url: String, album_name: Option<String>, file_name: String) -> Result<String, String> {
    let response = reqwest::get(&url).await.map_err(|e| e.to_string())?;
    let bytes = response.bytes().await.map_err(|e| e.to_string())?;
    
    // Get execution root
    let current_dir = std::env::current_dir().map_err(|e| e.to_string())?;
    let mut path = current_dir.join("download").join("navidrome");
    
    if let Some(album) = album_name {
        // Sanitize album name for filesystem
        let safe_album = album.replace(|c: char| !c.is_alphanumeric() && c != ' ', "_");
        path = path.join(safe_album);
    }
    
    // Sanitize file name
    let safe_file = file_name.replace(|c: char| !c.is_alphanumeric() && c != ' ' && c != '.', "_");
    path = path.join(safe_file);

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    
    let mut file = File::create(&path).map_err(|e| e.to_string())?;
    file.write_all(&bytes).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
async fn get_webview_cookies(app_handle: tauri::AppHandle, window_label: String) -> Result<Vec<String>, String> {
    use tauri::Manager;
    let window = app_handle.get_webview_window(&window_label).ok_or("Window not found")?;
    let cookies = window.cookies().map_err(|e| e.to_string())?;
    
    let mut cookie_strings = Vec::new();
    for cookie in cookies {
        cookie_strings.push(format!("{}={}", cookie.name(), cookie.value()));
    }
    Ok(cookie_strings)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      app.handle().plugin(tauri_plugin_dialog::init())?;
      app.handle().plugin(tauri_plugin_http::init())?;
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
        audio::scan_local_music,
        audio::get_cover_art,
        audio::read_lrc_file,
        download_file,
        get_webview_cookies
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

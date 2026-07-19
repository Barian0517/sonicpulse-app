mod audio;

use std::fs::{File, OpenOptions};
use std::io::Write;
use chrono::Local;

#[cfg(not(debug_assertions))]
use std::sync::Mutex;
#[cfg(not(debug_assertions))]
use tauri_plugin_shell::process::CommandChild;

#[cfg(not(debug_assertions))]
pub struct SidecarGuard(pub Mutex<Option<CommandChild>>);

#[cfg(not(debug_assertions))]
impl Drop for SidecarGuard {
    fn drop(&mut self) {
        if let Some(child) = self.0.lock().unwrap().take() {
            let _ = child.kill();
        }
    }
}

#[tauri::command]
async fn write_log(level: String, message: String) -> Result<(), String> {
    let current_dir = std::env::current_dir().map_err(|e| e.to_string())?;
    let log_dir = current_dir.join("log");
    
    if !log_dir.exists() {
        std::fs::create_dir_all(&log_dir).map_err(|e| e.to_string())?;
    }
    
    let log_file = log_dir.join("lastlog.txt");
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_file)
        .map_err(|e| e.to_string())?;
        
    let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S%.3f");
    let log_line = format!("[{}] [{}] {}\n", timestamp, level.to_uppercase(), message);
    
    file.write_all(log_line.as_bytes()).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn download_file(
    url: String,
    album_name: Option<String>,
    file_name: String,
) -> Result<String, String> {
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
async fn get_webview_cookies(
    app_handle: tauri::AppHandle,
    window_label: String,
) -> Result<Vec<String>, String> {
    use tauri::Manager;
    let window = app_handle
        .get_webview_window(&window_label)
        .ok_or("Window not found")?;
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
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(tauri_plugin_log::log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            app.handle().plugin(tauri_plugin_dialog::init())?;
            app.handle().plugin(tauri_plugin_http::init())?;
            
            #[cfg(not(debug_assertions))]
            {
                use tauri_plugin_shell::ShellExt;
                use std::sync::{Arc, Mutex};
                use tauri::Manager;
                let resource_path = app.handle()
                    .path()
                    .resource_dir()
                    .expect("failed to get resource dir")
                    .join("backend-dist")
                    .join("backend.cjs");
                
                match app.handle().shell().sidecar("node") {
                    Ok(command) => {
                        let command = command.arg(resource_path.to_string_lossy().into_owned());
                        match command.spawn() {
                            Ok((mut rx, child)) => {
                                app.manage(SidecarGuard(Mutex::new(Some(child))));
                                tauri::async_runtime::spawn(async move {
                                    while let Some(_event) = rx.recv().await {
                                        // Keep rx alive
                                    }
                                });
                                println!("Backend sidecar started successfully.");
                            }
                            Err(e) => {
                                eprintln!("Failed to spawn backend sidecar: {}", e);
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("Failed to find backend sidecar: {}", e);
                    }
                }
            }
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            audio::scan_local_music,
            audio::get_cover_art,
            audio::read_lrc_file,
            download_file,
            get_webview_cookies,
            write_log
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                #[cfg(not(debug_assertions))]
                {
                    use tauri::Manager;
                    if let Some(guard) = app_handle.try_state::<SidecarGuard>() {
                        if let Some(child) = guard.0.lock().unwrap().take() {
                            let _ = child.kill();
                        }
                    }
                }
            }
        });
}

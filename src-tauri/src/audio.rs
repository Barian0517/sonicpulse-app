use base64::Engine;
use lofty::file::AudioFile;
use lofty::file::TaggedFileExt;
use lofty::probe::Probe;
use lofty::tag::Accessor;
use serde::{Deserialize, Serialize};
use std::path::Path;
use walkdir::WalkDir;

#[derive(Debug, Serialize, Deserialize)]
pub struct TrackMetadata {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration_sec: u64,
    pub file_path: String,
    pub has_cover: bool,
}

#[tauri::command]
pub fn scan_local_music(path: String) -> Result<Vec<TrackMetadata>, String> {
    let mut tracks = Vec::new();

    if !Path::new(&path).exists() {
        return Err(format!("Directory not found: {}", path));
    }

    for entry in WalkDir::new(&path).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
        if ext != "mp3" && ext != "flac" && ext != "wav" && ext != "m4a" && ext != "ogg" {
            continue;
        }

        // Try to read metadata
        if let Ok(tagged_file) = Probe::open(path).and_then(|p| p.read()) {
            let tag = tagged_file.primary_tag().or_else(|| tagged_file.first_tag());
            
            let mut title = path.file_stem().unwrap_or_default().to_string_lossy().to_string();
            let mut artist = String::from("Unknown Artist");
            let mut album = String::from("Unknown Album");
            let mut has_cover = false;

            if let Some(tag) = tag {
                if let Some(t) = tag.title() { title = t.to_string(); }
                if let Some(a) = tag.artist() { artist = a.to_string(); }
                if let Some(al) = tag.album() { album = al.to_string(); }
                if !tag.pictures().is_empty() {
                    has_cover = true;
                }
            }

            let properties = tagged_file.properties();
            let duration_sec = properties.duration().as_secs();

            tracks.push(TrackMetadata {
                id: path.to_string_lossy().to_string(), // Use path as ID for local files
                title,
                artist,
                album,
                duration_sec,
                file_path: path.to_string_lossy().to_string(),
                has_cover,
            });
        }
    }

    Ok(tracks)
}

#[tauri::command]
pub fn get_cover_art(file_path: String) -> Result<Option<String>, String> {
    let path = Path::new(&file_path);
    if !path.exists() || !path.is_file() {
        return Err("File not found".to_string());
    }

    if let Ok(tagged_file) = Probe::open(path).and_then(|p| p.read()) {
        let tag = tagged_file.primary_tag().or_else(|| tagged_file.first_tag());
        if let Some(tag) = tag {
            let pictures = tag.pictures();
            if let Some(pic) = pictures.first() {
                let mime = pic.mime_type().map(|m| m.as_str()).unwrap_or("image/jpeg");
                let b64 = base64::engine::general_purpose::STANDARD.encode(pic.data());
                return Ok(Some(format!("data:{};base64,{}", mime, b64)));
            }
        }
    }

    Ok(None)
}

#[tauri::command]
pub fn read_lrc_file(file_path: String) -> Result<Option<String>, String> {
    let path = Path::new(&file_path);
    let mut lrc_path = path.to_path_buf();
    lrc_path.set_extension("lrc");

    if lrc_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&lrc_path) {
            return Ok(Some(content));
        }
    }
    
    // Also try checking for same file name but .LRC
    lrc_path.set_extension("LRC");
    if lrc_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&lrc_path) {
            return Ok(Some(content));
        }
    }

    Ok(None)
}

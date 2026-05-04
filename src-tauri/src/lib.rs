use std::path::{Path, PathBuf};
use tauri::Manager;
use tracing_subscriber::EnvFilter;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// Adım 13 — read the user's keymap override file from
// %APPDATA%\Tylike\conf\conf.user.json (or the platform-equivalent
// config_dir). Returns an empty string if the file is missing so the
// frontend can treat that case as "no overrides" without an error.
#[tauri::command]
fn read_user_config(app: tauri::AppHandle) -> Result<String, String> {
    let path = user_config_path(&app).map_err(|e| e.to_string())?;
    if !path.exists() {
        return Ok(String::new());
    }
    std::fs::read_to_string(&path).map_err(|e| format!("read {}: {}", path.display(), e))
}

fn user_config_path(app: &tauri::AppHandle) -> Result<PathBuf, tauri::Error> {
    let dir = app.path().app_config_dir()?;
    Ok(dir.join("conf").join("conf.user.json"))
}

// MVP-6 — load the user's optional custom CSS from
// %APPDATA%\Tylike\themes\custom.css (or platform equivalent). Empty
// string when the file is missing so the frontend can treat absence as
// "no custom CSS" without an error.
#[tauri::command]
fn read_user_css(app: tauri::AppHandle) -> Result<String, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    let path = dir.join("themes").join("custom.css");
    if !path.exists() {
        return Ok(String::new());
    }
    std::fs::read_to_string(&path).map_err(|e| format!("read {}: {}", path.display(), e))
}

// MVP-2 — file I/O. Native open / save dialogs use the `rfd` crate; the
// read / write commands are plain std::fs calls. Returning Result<_, String>
// so the frontend gets a Promise that rejects with a readable message on
// failure.

#[tauri::command]
async fn open_file_dialog() -> Option<String> {
    let file = rfd::AsyncFileDialog::new()
        .add_filter("Markdown", &["md", "markdown", "txt"])
        .pick_file()
        .await;
    file.map(|f| f.path().to_string_lossy().to_string())
}

#[tauri::command]
async fn save_file_dialog(default_name: Option<String>) -> Option<String> {
    let mut dialog = rfd::AsyncFileDialog::new()
        .add_filter("Markdown", &["md", "markdown"]);
    if let Some(name) = default_name.as_deref() {
        dialog = dialog.set_file_name(name);
    }
    dialog
        .save_file()
        .await
        .map(|f| f.path().to_string_lossy().to_string())
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("read {}: {}", path, e))
}

#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| format!("write {}: {}", path, e))
}

// MVP-5 — crash-recovery snapshot. Stored as JSON in app_config_dir so it
// survives app restarts and is written atomically on each tick. The
// frontend writes when the doc is dirty (debounced) and clears when a
// successful save brings it back to clean.

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct RecoverySnapshot {
    file_path: Option<String>,
    content: String,
    saved_at: String,
}

fn recovery_path(app: &tauri::AppHandle) -> Result<PathBuf, tauri::Error> {
    let dir = app.path().app_config_dir()?;
    Ok(dir.join("recovery.json"))
}

#[tauri::command]
fn write_recovery(
    app: tauri::AppHandle,
    snapshot: RecoverySnapshot,
) -> Result<(), String> {
    let path = recovery_path(&app).map_err(|e| e.to_string())?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json =
        serde_json::to_string(&snapshot).map_err(|e| format!("serialize: {}", e))?;
    std::fs::write(&path, json).map_err(|e| format!("write {}: {}", path.display(), e))
}

#[tauri::command]
fn read_recovery(app: tauri::AppHandle) -> Result<Option<RecoverySnapshot>, String> {
    let path = recovery_path(&app).map_err(|e| e.to_string())?;
    if !path.exists() {
        return Ok(None);
    }
    let json = std::fs::read_to_string(&path)
        .map_err(|e| format!("read {}: {}", path.display(), e))?;
    let snap: RecoverySnapshot = serde_json::from_str(&json)
        .map_err(|e| format!("parse recovery: {}", e))?;
    Ok(Some(snap))
}

#[tauri::command]
fn clear_recovery(app: tauri::AppHandle) -> Result<(), String> {
    let path = recovery_path(&app).map_err(|e| e.to_string())?;
    if path.exists() {
        std::fs::remove_file(&path)
            .map_err(|e| format!("delete {}: {}", path.display(), e))?;
    }
    Ok(())
}

// MVP-3 — folder picker + recursive directory listing for the sidebar tree.
// Only markdown / text files are surfaced; hidden entries (`.git`, dotfiles)
// are skipped. Directories come before files, then alphabetically.

#[derive(serde::Serialize)]
struct FileEntry {
    name: String,
    path: String,
    is_dir: bool,
    children: Option<Vec<FileEntry>>,
}

#[tauri::command]
async fn pick_folder_dialog() -> Option<String> {
    rfd::AsyncFileDialog::new()
        .pick_folder()
        .await
        .map(|f| f.path().to_string_lossy().to_string())
}

#[tauri::command]
fn read_dir_tree(path: String) -> Result<FileEntry, String> {
    let p = PathBuf::from(&path);
    read_entry(&p).map_err(|e| format!("read {}: {}", path, e))
}

fn read_entry(path: &Path) -> std::io::Result<FileEntry> {
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string_lossy().to_string());
    let metadata = path.metadata()?;

    if metadata.is_dir() {
        let mut children = Vec::new();
        for entry in std::fs::read_dir(path)? {
            let entry = entry?;
            let entry_name = entry.file_name().to_string_lossy().to_string();
            if entry_name.starts_with('.') {
                continue;
            }
            let entry_path = entry.path();
            let entry_meta = match entry.metadata() {
                Ok(m) => m,
                Err(_) => continue, // skip unreadable entries instead of failing the whole tree
            };
            if !entry_meta.is_dir() {
                let ext = entry_path
                    .extension()
                    .and_then(|e| e.to_str())
                    .map(|s| s.to_lowercase());
                let supported = matches!(
                    ext.as_deref(),
                    Some("md") | Some("markdown") | Some("txt")
                );
                if !supported {
                    continue;
                }
            }
            match read_entry(&entry_path) {
                Ok(child) => children.push(child),
                Err(_) => continue,
            }
        }
        children.sort_by(|a, b| match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        });
        Ok(FileEntry {
            name,
            path: path.to_string_lossy().to_string(),
            is_dir: true,
            children: Some(children),
        })
    } else {
        Ok(FileEntry {
            name,
            path: path.to_string_lossy().to_string(),
            is_dir: false,
            children: None,
        })
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,typertype_lib=debug".into()),
        )
        .init();

    tracing::info!("Starting Tylike");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            read_user_config,
            read_user_css,
            open_file_dialog,
            save_file_dialog,
            read_text_file,
            write_text_file,
            pick_folder_dialog,
            read_dir_tree,
            write_recovery,
            read_recovery,
            clear_recovery,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

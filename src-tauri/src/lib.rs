use std::path::PathBuf;
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
            open_file_dialog,
            save_file_dialog,
            read_text_file,
            write_text_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

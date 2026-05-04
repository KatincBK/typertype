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
        .invoke_handler(tauri::generate_handler![greet, read_user_config])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

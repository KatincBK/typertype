use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use tauri::{Manager, State};
use tracing_subscriber::EnvFilter;

// MVP-9 — initial CLI args. When the user double-clicks a .md file or
// runs `tylike <path>` from a shell, the OS launches us with the path as
// argv[1]. We snapshot it once at startup, expose it via a Tauri command,
// and let the frontend pull it during mount so the recovery prompt and
// the "open this file" flow can sequence themselves correctly.

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct InitialArgs {
    file: Option<String>,
}

#[tauri::command]
fn get_initial_args(state: State<'_, InitialArgs>) -> InitialArgs {
    state.inner().clone()
}

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

// MVP-8 — expose well-known config paths to the frontend so the Settings
// dialog can offer "open this in your editor / file manager" buttons. We
// also create the parent dirs and a stub file on demand so the user
// doesn't end up with "file not found" when clicking Open.

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ConfigPaths {
    config_dir: String,
    user_config_file: String,
    themes_dir: String,
    themes_custom_css: String,
}

#[tauri::command]
fn get_config_paths(app: tauri::AppHandle) -> Result<ConfigPaths, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    let conf_file = dir.join("conf").join("conf.user.json");
    let themes_dir = dir.join("themes");
    let custom_css = themes_dir.join("custom.css");
    Ok(ConfigPaths {
        config_dir: dir.to_string_lossy().to_string(),
        user_config_file: conf_file.to_string_lossy().to_string(),
        themes_dir: themes_dir.to_string_lossy().to_string(),
        themes_custom_css: custom_css.to_string_lossy().to_string(),
    })
}

#[tauri::command]
fn ensure_user_config_exists(app: tauri::AppHandle) -> Result<String, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    let conf_dir = dir.join("conf");
    std::fs::create_dir_all(&conf_dir)
        .map_err(|e| format!("create {}: {}", conf_dir.display(), e))?;
    let path = conf_dir.join("conf.user.json");
    if !path.exists() {
        std::fs::write(&path, "{\n  \"keymap\": {}\n}\n")
            .map_err(|e| format!("write {}: {}", path.display(), e))?;
    }
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn ensure_themes_dir_exists(app: tauri::AppHandle) -> Result<String, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    let themes_dir = dir.join("themes");
    std::fs::create_dir_all(&themes_dir)
        .map_err(|e| format!("create {}: {}", themes_dir.display(), e))?;
    let custom_css = themes_dir.join("custom.css");
    if !custom_css.exists() {
        std::fs::write(
            &custom_css,
            "/* Tylike kullanıcı stilleri. Buraya yazdığınız CSS,\n   uygulama yeniden başlatıldığında uygulanır. */\n",
        )
        .map_err(|e| format!("write {}: {}", custom_css.display(), e))?;
    }
    Ok(themes_dir.to_string_lossy().to_string())
}

// FAZ 11 — Image insertion. Three commands cover the three sources:
//   pick_image_dialog: native picker for "Insert image…"
//   copy_image_to_assets: existing on-disk image (drag-drop, picker)
//   write_image_bytes: clipboard paste of a binary blob
// All three return the path that should go into the markdown source —
// relative to the doc when it's saved to disk, absolute under the app
// data dir when the doc is still untitled.

#[tauri::command]
async fn pick_image_dialog() -> Option<String> {
    rfd::AsyncFileDialog::new()
        .add_filter("Image", &["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"])
        .pick_file()
        .await
        .map(|f| f.path().to_string_lossy().to_string())
}

fn unique_dest(dir: &Path, file_name: &str) -> PathBuf {
    let candidate = dir.join(file_name);
    if !candidate.exists() {
        return candidate;
    }
    let stem = Path::new(file_name)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("image");
    let ext = Path::new(file_name)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("");
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis().to_string())
        .unwrap_or_else(|_| "0".to_string());
    let new_name = if ext.is_empty() {
        format!("{stem}-{ts}")
    } else {
        format!("{stem}-{ts}.{ext}")
    };
    dir.join(new_name)
}

fn doc_assets_dir(doc_path: &Path) -> Result<(PathBuf, String), String> {
    let parent = doc_path
        .parent()
        .ok_or_else(|| "Belge yolunun üst klasörü yok".to_string())?;
    let stem = doc_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("untitled")
        .to_string();
    let dir_name = format!("{stem}.assets");
    Ok((parent.join(&dir_name), dir_name))
}

fn untitled_assets_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("assets");
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("create {}: {}", dir.display(), e))?;
    Ok(dir)
}

#[tauri::command]
fn copy_image_to_assets(
    app: tauri::AppHandle,
    source_path: String,
    doc_path: Option<String>,
) -> Result<String, String> {
    let source = PathBuf::from(&source_path);
    if !source.exists() {
        return Err(format!("Kaynak yok: {}", source.display()));
    }
    let file_name = source
        .file_name()
        .ok_or_else(|| "Kaynağın dosya adı yok".to_string())?
        .to_string_lossy()
        .to_string();

    if let Some(dp) = doc_path {
        let doc = PathBuf::from(&dp);
        let (dir, dir_name) = doc_assets_dir(&doc)?;
        std::fs::create_dir_all(&dir)
            .map_err(|e| format!("create {}: {}", dir.display(), e))?;
        let dest = unique_dest(&dir, &file_name);
        std::fs::copy(&source, &dest)
            .map_err(|e| format!("copy: {}", e))?;
        let final_name = dest
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or(&file_name);
        Ok(format!("{dir_name}/{final_name}"))
    } else {
        let dir = untitled_assets_dir(&app)?;
        let dest = unique_dest(&dir, &file_name);
        std::fs::copy(&source, &dest)
            .map_err(|e| format!("copy: {}", e))?;
        Ok(dest.to_string_lossy().to_string())
    }
}

#[tauri::command]
fn write_image_bytes(
    app: tauri::AppHandle,
    bytes: Vec<u8>,
    extension: String,
    doc_path: Option<String>,
) -> Result<String, String> {
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis().to_string())
        .unwrap_or_else(|_| "0".to_string());
    let safe_ext = extension
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .collect::<String>();
    let ext = if safe_ext.is_empty() { "png".to_string() } else { safe_ext };
    let file_name = format!("paste-{ts}.{ext}");

    if let Some(dp) = doc_path {
        let doc = PathBuf::from(&dp);
        let (dir, dir_name) = doc_assets_dir(&doc)?;
        std::fs::create_dir_all(&dir)
            .map_err(|e| format!("create {}: {}", dir.display(), e))?;
        let dest = unique_dest(&dir, &file_name);
        std::fs::write(&dest, &bytes).map_err(|e| format!("write: {}", e))?;
        let final_name = dest
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or(&file_name);
        Ok(format!("{dir_name}/{final_name}"))
    } else {
        let dir = untitled_assets_dir(&app)?;
        let dest = unique_dest(&dir, &file_name);
        std::fs::write(&dest, &bytes).map_err(|e| format!("write: {}", e))?;
        Ok(dest.to_string_lossy().to_string())
    }
}

// MVP-7 — Pandoc-driven export. We pipe the markdown source over stdin
// instead of writing a temp file, and capture stderr so the frontend can
// surface Pandoc's actual error message (missing LaTeX engine for PDF,
// unknown format, etc.) rather than a generic "exit code N".

#[tauri::command]
fn check_pandoc() -> Result<String, String> {
    let output = Command::new("pandoc").arg("--version").output();
    match output {
        Ok(o) if o.status.success() => {
            let stdout = String::from_utf8_lossy(&o.stdout);
            let first_line = stdout.lines().next().unwrap_or("Pandoc");
            Ok(first_line.to_string())
        }
        Ok(o) => {
            let err = String::from_utf8_lossy(&o.stderr);
            Err(format!("pandoc --version failed: {}", err))
        }
        Err(_) => Err(
            "Pandoc bulunamadı. https://pandoc.org/installing.html adresinden kurun ve PATH'e ekleyin."
                .to_string(),
        ),
    }
}

#[tauri::command]
fn pandoc_export(
    markdown: String,
    output_path: String,
    output_format: String,
) -> Result<(), String> {
    let mut child = Command::new("pandoc")
        .args([
            "-f",
            "markdown+tex_math_dollars+pipe_tables+task_lists+footnotes+raw_html",
            "-t",
            &output_format,
            "-o",
            &output_path,
            "--standalone",
        ])
        .stdin(Stdio::piped())
        .stderr(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()
        .map_err(|e| {
            format!(
                "Pandoc başlatılamadı (PATH'te değil mi?): {}",
                e
            )
        })?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(markdown.as_bytes())
            .map_err(|e| format!("Pandoc stdin: {}", e))?;
        // Closing stdin signals EOF to pandoc.
    }

    let output = child
        .wait_with_output()
        .map_err(|e| format!("Pandoc bekleme: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "Pandoc çıkış {}: {}",
            output.status, stderr.trim()
        ));
    }
    Ok(())
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

    // Capture the file path argument *before* Tauri parses its own argv
    // (which strips known Tauri flags). For .md double-click on Windows
    // and Linux, argv[1] is the absolute path the OS hands to us.
    let initial_file = std::env::args()
        .nth(1)
        .filter(|a| !a.starts_with("--") && !a.is_empty());

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(InitialArgs {
            file: initial_file,
        })
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
            check_pandoc,
            pandoc_export,
            get_config_paths,
            ensure_user_config_exists,
            ensure_themes_dir_exists,
            get_initial_args,
            pick_image_dialog,
            copy_image_to_assets,
            write_image_bytes,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

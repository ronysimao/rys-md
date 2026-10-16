use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeSet, HashMap};
use std::fs;
use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
use tiny_http::{Header, Method, Response, Server, StatusCode};
use url::Url;
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct NoteMetaEntry {
    id: Option<String>,
    pinned: bool,
    original_folder: Option<String>,
    created_at: Option<u64>,
    updated_at: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct RysIndexFile {
    notes: HashMap<String, NoteMetaEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteItem {
    pub id: String,
    pub relative_path: String,
    pub folder: String,
    pub title: String,
    pub preview: String,
    pub content: String,
    pub tags: Vec<String>,
    pub pinned: bool,
    pub trashed: bool,
    pub created_at: u64,
    pub updated_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultState {
    pub vault_path: String,
    pub folders: Vec<String>,
    pub notes: Vec<NoteItem>,
}

const WELCOME_NOTE_CONTENT: &str = r#"# Bem-vindo ao Rys MD ✨

O **Rys MD** une a organização elegante e instantânea do **Apple Notes** com o poderoso editor Markdown Dual-Mode do **Orca ADE**, rodando nativamente com motor **Rust**.

---

## 🚀 Superpoderes do Editor (Orca ADE Engine)

Experimente digitar `/` em qualquer linha vazia para abrir o **Menu de Comandos Slash**, ou alterne entre o modo **Rich (WYSIWYG)** e **Source (Markdown cru)** no canto superior direito!

### 1. Checklists Interativos
- [x] Arquitetura híbrida Rust + Tiptap v3 (`@tiptap/markdown`)
- [x] Layout de 3 colunas redimensionáveis estilo Apple Notes
- [ ] Pressione `/` e escolha **Check List** ou **Table** para testar
- [ ] Cole uma imagem da área de transferência (`Ctrl+V`) direto na nota

#bem-vindo #rys-md #orca
"#;

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn generate_id(rel_path: &str, created: u64) -> String {
    let mut h: u64 = 0xcbf29ce484222325;
    for b in rel_path.bytes() {
        h ^= b as u64;
        h = h.wrapping_mul(0x100000001b3);
    }
    format!("note-{created}-{h:x}")
}

fn resolve_vault_dir(vault_path: Option<String>) -> PathBuf {
    if let Some(custom) = vault_path {
        let trimmed = custom.trim();
        if !trimmed.is_empty() {
            if let Some(stripped) = trimmed.strip_prefix("~/") {
                if let Some(home) = dirs::home_dir() {
                    return home.join(stripped);
                }
            }
            return PathBuf::from(trimmed);
        }
    }
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    let doc_pt = home.join("Documentos");
    if doc_pt.exists() {
        doc_pt.join("RYS MD")
    } else {
        home.join("Documents").join("RYS MD")
    }
}

fn read_index(vault_dir: &Path) -> RysIndexFile {
    let idx_path = vault_dir.join(".rys-index.json");
    if let Ok(raw) = fs::read_to_string(idx_path) {
        if let Ok(parsed) = serde_json::from_str::<RysIndexFile>(&raw) {
            return parsed;
        }
    }
    RysIndexFile::default()
}

fn write_index(vault_dir: &Path, index: &RysIndexFile) {
    let idx_path = vault_dir.join(".rys-index.json");
    if let Ok(json) = serde_json::to_string_pretty(index) {
        let _ = fs::write(idx_path, json);
    }
}

fn ensure_vault_initialized(vault_dir: &Path) -> Result<(), String> {
    fs::create_dir_all(vault_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(vault_dir.join("assets")).map_err(|e| e.to_string())?;
    fs::create_dir_all(vault_dir.join(".trash")).map_err(|e| e.to_string())?;

    let idx_path = vault_dir.join(".rys-index.json");
    if !idx_path.exists() {
        let _ = fs::create_dir_all(vault_dir.join("Pessoal"));
        let _ = fs::create_dir_all(vault_dir.join("Trabalho"));
        let welcome_rel = "Bem-vindo ao Rys MD ✨.md";
        let welcome_abs = vault_dir.join(welcome_rel);
        if !welcome_abs.exists() {
            let _ = fs::write(&welcome_abs, WELCOME_NOTE_CONTENT);
        }
        let now = now_millis();
        let mut index = RysIndexFile::default();
        index.notes.insert(
            welcome_rel.to_string(),
            NoteMetaEntry {
                id: Some(generate_id(welcome_rel, now)),
                pinned: true,
                original_folder: None,
                created_at: Some(now),
                updated_at: Some(now),
            },
        );
        write_index(vault_dir, &index);
    }
    Ok(())
}

fn sanitize_filename(title: &str) -> String {
    let cleaned: String = title
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '-',
            _ => c,
        })
        .collect();
    let collapsed = cleaned.split_whitespace().collect::<Vec<_>>().join(" ");
    let trimmed = collapsed.trim().trim_matches('.');
    if trimmed.is_empty() {
        "Nova Nota".to_string()
    } else {
        trimmed.chars().take(80).collect()
    }
}

fn extract_title_preview_tags(content: &str, fallback_name: &str) -> (String, String, Vec<String>) {
    let body = if content.starts_with("---\n") || content.starts_with("---\r\n") {
        if let Some(idx) = content[4..].find("\n---") {
            &content[4 + idx + 4..]
        } else {
            content
        }
    } else {
        content
    };

    let mut title = String::new();
    let mut preview = String::new();
    let heading_re = Regex::new(r"^#{1,6}\s+(.+)$").unwrap();

    for raw_line in body.lines() {
        let line = raw_line.trim();
        if line.is_empty() || line.starts_with("```") {
            continue;
        }
        if title.is_empty() {
            if let Some(caps) = heading_re.captures(line) {
                title = caps[1].trim().to_string();
            } else {
                title = line.trim_start_matches(&['-', '*', '>', ' '][..]).to_string();
            }
            continue;
        }
        if preview.is_empty()
            && !line.starts_with("<details")
            && !line.starts_with("</details")
            && !line.starts_with("<summary")
        {
            preview = line.replace("**", "").replace("__", "").replace('`', "");
            break;
        }
    }

    if title.is_empty() {
        title = fallback_name.trim_end_matches(".md").to_string();
    }
    if preview.is_empty() {
        preview = "Sem texto adicional".to_string();
    }

    let tag_re = Regex::new(r"(?:^|\s)#([a-zA-ZÀ-ÿ0-9_-]{2,32})").unwrap();
    let mut tags_set = BTreeSet::new();
    for caps in tag_re.captures_iter(body) {
        tags_set.insert(caps[1].to_lowercase());
    }

    (title, preview, tags_set.into_iter().collect())
}

fn build_vault_state(vault_dir: &Path) -> Result<VaultState, String> {
    ensure_vault_initialized(vault_dir)?;

    let mut index = read_index(vault_dir);
    let mut index_dirty = false;
    let mut folders_set = BTreeSet::new();
    let mut notes = Vec::new();

    for entry in WalkDir::new(vault_dir).min_depth(1).into_iter().flatten() {
        let path = entry.path();
        let rel = match path.strip_prefix(vault_dir) {
            Ok(r) => r.to_string_lossy().replace('\\', "/"),
            Err(_) => continue,
        };

        if rel.starts_with("assets") || rel == ".rys-index.json" {
            continue;
        }

        let is_trash = rel == ".trash" || rel.starts_with(".trash/");
        if !is_trash && rel.split('/').any(|p| p.starts_with('.')) {
            continue;
        }

        if path.is_dir() {
            if !is_trash {
                folders_set.insert(rel);
            }
            continue;
        }

        if path.extension().and_then(|s| s.to_str()) != Some("md") {
            continue;
        }

        let content = fs::read_to_string(path).unwrap_or_default();
        let file_name = path
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("Nota.md");
        let (title, preview, tags) = extract_title_preview_tags(&content, file_name);

        let meta = fs::metadata(path).ok();
        let fs_mtime = meta
            .as_ref()
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or_else(now_millis);

        let entry_meta = index.notes.entry(rel.clone()).or_default();
        if entry_meta.id.is_none() {
            entry_meta.id = Some(generate_id(&rel, fs_mtime));
            entry_meta.created_at = Some(entry_meta.created_at.unwrap_or(fs_mtime));
            entry_meta.updated_at = Some(entry_meta.updated_at.unwrap_or(fs_mtime));
            index_dirty = true;
        }

        let note_id = entry_meta.id.clone().unwrap_or_else(|| rel.clone());
        let folder = if is_trash {
            ".trash".to_string()
        } else {
            path.parent()
                .and_then(|p| p.strip_prefix(vault_dir).ok())
                .map(|p| p.to_string_lossy().replace('\\', "/"))
                .unwrap_or_default()
        };

        notes.push(NoteItem {
            id: note_id,
            relative_path: rel,
            folder,
            title,
            preview,
            content,
            tags,
            pinned: entry_meta.pinned && !is_trash,
            trashed: is_trash,
            created_at: entry_meta.created_at.unwrap_or(fs_mtime),
            updated_at: entry_meta.updated_at.unwrap_or(fs_mtime),
        });
    }

    if index_dirty {
        write_index(vault_dir, &index);
    }

    notes.sort_by(|a, b| {
        b.pinned
            .cmp(&a.pinned)
            .then_with(|| b.updated_at.cmp(&a.updated_at))
    });

    Ok(VaultState {
        vault_path: vault_dir.to_string_lossy().to_string(),
        folders: folders_set.into_iter().collect(),
        notes,
    })
}

fn handle_api_post(pathname: &str, body: &serde_json::Value) -> Result<serde_json::Value, String> {
    let vault_path = body
        .get("vaultPath")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let dir = resolve_vault_dir(vault_path);

    match pathname {
        "/api/vault/scan" => {
            let state = build_vault_state(&dir)?;
            serde_json::to_value(state).map_err(|e| e.to_string())
        }
        "/api/vault/save-note" => {
            let relative_path = body
                .get("relativePath")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
            let content = body
                .get("content")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
            let auto_rename = body
                .get("autoRename")
                .and_then(|v| v.as_bool())
                .unwrap_or(true);

            let current_abs = dir.join(&relative_path);
            if let Some(parent) = current_abs.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            fs::write(&current_abs, &content).map_err(|e| e.to_string())?;

            let mut final_rel = relative_path.clone();
            let mut index = read_index(&dir);

            if auto_rename && !relative_path.starts_with(".trash/") {
                let (title, _, _) = extract_title_preview_tags(&content, "Nova Nota.md");
                let desired_stem = sanitize_filename(&title);
                let parent_rel = Path::new(&relative_path)
                    .parent()
                    .map(|p| p.to_string_lossy().replace('\\', "/"))
                    .unwrap_or_default();

                let candidate_rel = if parent_rel.is_empty() {
                    format!("{desired_stem}.md")
                } else {
                    format!("{parent_rel}/{desired_stem}.md")
                };

                if candidate_rel != relative_path {
                    let mut unique_rel = candidate_rel;
                    let mut counter = 2;
                    while unique_rel != relative_path && dir.join(&unique_rel).exists() {
                        unique_rel = if parent_rel.is_empty() {
                            format!("{desired_stem} ({counter}).md")
                        } else {
                            format!("{parent_rel}/{desired_stem} ({counter}).md")
                        };
                        counter += 1;
                    }
                    if unique_rel != relative_path
                        && fs::rename(&current_abs, dir.join(&unique_rel)).is_ok()
                    {
                        if let Some(old_meta) = index.notes.remove(&relative_path) {
                            index.notes.insert(unique_rel.clone(), old_meta);
                        }
                        final_rel = unique_rel;
                    }
                }
            }

            let now = now_millis();
            let entry = index.notes.entry(final_rel.clone()).or_default();
            if entry.id.is_none() {
                entry.id = Some(generate_id(&final_rel, now));
            }
            entry.updated_at = Some(now);
            if entry.created_at.is_none() {
                entry.created_at = Some(now);
            }
            write_index(&dir, &index);

            let state = build_vault_state(&dir)?;
            Ok(serde_json::json!({
                "finalRelativePath": final_rel,
                "state": state
            }))
        }
        "/api/vault/create-note" => {
            let folder_clean = body
                .get("folder")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .trim_matches('/')
                .to_string();
            let target_dir = if folder_clean.is_empty() {
                dir.clone()
            } else {
                dir.join(&folder_clean)
            };
            fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;

            let mut idx = 1;
            let mut file_name = "Nova Nota.md".to_string();
            while target_dir.join(&file_name).exists() {
                idx += 1;
                file_name = format!("Nova Nota ({idx}).md");
            }

            let rel_path = if folder_clean.is_empty() {
                file_name.clone()
            } else {
                format!("{folder_clean}/{file_name}")
            };

            let stem = file_name.trim_end_matches(".md");
            let initial = body
                .get("initialContent")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .unwrap_or_else(|| format!("# {stem}\n\n"));
            fs::write(dir.join(&rel_path), initial).map_err(|e| e.to_string())?;

            let now = now_millis();
            let mut index = read_index(&dir);
            index.notes.insert(
                rel_path.clone(),
                NoteMetaEntry {
                    id: Some(generate_id(&rel_path, now)),
                    pinned: false,
                    original_folder: None,
                    created_at: Some(now),
                    updated_at: Some(now),
                },
            );
            write_index(&dir, &index);

            let state = build_vault_state(&dir)?;
            Ok(serde_json::json!({
                "createdRelativePath": rel_path,
                "state": state
            }))
        }
        "/api/vault/toggle-pin" => {
            let relative_path = body
                .get("relativePath")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
            let mut index = read_index(&dir);
            let entry = index.notes.entry(relative_path).or_default();
            entry.pinned = !entry.pinned;
            write_index(&dir, &index);
            let state = build_vault_state(&dir)?;
            Ok(serde_json::json!({ "state": state }))
        }
        "/api/vault/trash-note" => {
            let relative_path = body
                .get("relativePath")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
            let mut index = read_index(&dir);
            let abs = dir.join(&relative_path);

            if relative_path.starts_with(".trash/") {
                let _ = fs::remove_file(abs);
                index.notes.remove(&relative_path);
            } else {
                let trash_dir = dir.join(".trash");
                fs::create_dir_all(&trash_dir).map_err(|e| e.to_string())?;
                let base_name = Path::new(&relative_path)
                    .file_name()
                    .and_then(|s| s.to_str())
                    .unwrap_or("Nota.md");
                let trash_rel = format!(".trash/{base_name}");
                let orig_folder = Path::new(&relative_path)
                    .parent()
                    .map(|p| p.to_string_lossy().replace('\\', "/"))
                    .unwrap_or_default();
                let _ = fs::rename(&abs, dir.join(&trash_rel));
                let mut meta = index.notes.remove(&relative_path).unwrap_or_default();
                meta.pinned = false;
                meta.original_folder = Some(orig_folder);
                index.notes.insert(trash_rel, meta);
            }
            write_index(&dir, &index);
            let state = build_vault_state(&dir)?;
            Ok(serde_json::json!({ "state": state }))
        }
        "/api/vault/restore-note" => {
            let relative_path = body
                .get("relativePath")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
            let mut index = read_index(&dir);
            let meta = index.notes.remove(&relative_path).unwrap_or_default();
            let orig_folder = meta.original_folder.clone().unwrap_or_default();
            let base_name = Path::new(&relative_path)
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("Nota.md");

            let target_rel = if orig_folder.is_empty() {
                base_name.to_string()
            } else {
                let _ = fs::create_dir_all(dir.join(&orig_folder));
                format!("{orig_folder}/{base_name}")
            };

            let _ = fs::rename(dir.join(&relative_path), dir.join(&target_rel));
            index.notes.insert(target_rel.clone(), meta);
            write_index(&dir, &index);

            let state = build_vault_state(&dir)?;
            Ok(serde_json::json!({
                "restoredRelativePath": target_rel,
                "state": state
            }))
        }
        "/api/vault/move-note" => {
            let relative_path = body
                .get("relativePath")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
            let target_folder = body
                .get("targetFolder")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .trim_matches('/')
                .to_string();
            let base_name = Path::new(&relative_path)
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("Nota.md");

            let dest_rel = if target_folder.is_empty() {
                base_name.to_string()
            } else {
                let _ = fs::create_dir_all(dir.join(&target_folder));
                format!("{target_folder}/{base_name}")
            };

            if dest_rel != relative_path {
                fs::rename(dir.join(&relative_path), dir.join(&dest_rel))
                    .map_err(|e| e.to_string())?;
                let mut index = read_index(&dir);
                if let Some(meta) = index.notes.remove(&relative_path) {
                    index.notes.insert(dest_rel.clone(), meta);
                    write_index(&dir, &index);
                }
            }

            let state = build_vault_state(&dir)?;
            Ok(serde_json::json!({
                "movedRelativePath": dest_rel,
                "state": state
            }))
        }
        "/api/vault/create-folder" => {
            let folder_path = body
                .get("folderPath")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .trim_matches('/')
                .to_string();
            if !folder_path.is_empty() {
                fs::create_dir_all(dir.join(&folder_path)).map_err(|e| e.to_string())?;
            }
            let state = build_vault_state(&dir)?;
            Ok(serde_json::json!({
                "createdFolder": folder_path,
                "state": state
            }))
        }
        "/api/vault/delete-folder" => {
            let folder_path = body
                .get("folderPath")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .trim_matches('/')
                .to_string();
            let target = dir.join(&folder_path);
            if target.exists() {
                let _ = fs::remove_dir_all(target);
            }
            let state = build_vault_state(&dir)?;
            Ok(serde_json::json!({ "state": state }))
        }
        "/api/vault/save-asset" => {
            let file_name = body
                .get("fileName")
                .and_then(|v| v.as_str())
                .unwrap_or("image.png");
            let base64_data = body
                .get("base64Data")
                .and_then(|v| v.as_str())
                .unwrap_or_default();
            let assets_dir = dir.join("assets");
            fs::create_dir_all(&assets_dir).map_err(|e| e.to_string())?;

            let clean_payload = base64_data
                .split(',')
                .next_back()
                .unwrap_or(base64_data);
            let bytes = BASE64.decode(clean_payload).map_err(|e| e.to_string())?;
            let safe_name = sanitize_filename(file_name);
            let stamped = format!("{}-{}", now_millis(), safe_name);
            let rel_asset = format!("assets/{stamped}");
            fs::write(dir.join(&rel_asset), bytes).map_err(|e| e.to_string())?;
            Ok(serde_json::json!({ "relativeAssetPath": rel_asset }))
        }
        "/api/vault/reveal-in-folder" => {
            let rel = body.get("relativePath").and_then(|v| v.as_str());
            let target = if let Some(r) = rel {
                let abs = dir.join(r);
                abs.parent().map(|p| p.to_path_buf()).unwrap_or(dir)
            } else {
                dir
            };
            let _ = Command::new("xdg-open").arg(target).spawn();
            Ok(serde_json::json!({ "ok": true }))
        }
        _ => Err("Not found".to_string()),
    }
}

fn find_dist_dir() -> PathBuf {
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()))
        .unwrap_or_else(|| PathBuf::from("."));

    let candidates = [
        PathBuf::from("/usr/lib/rys-md/dist"),
        exe_dir.join("../lib/rys-md/dist"),
        exe_dir.join("dist"),
        PathBuf::from("dist"),
    ];
    for c in candidates {
        if c.join("index.html").exists() {
            return c;
        }
    }
    PathBuf::from("/usr/lib/rys-md/dist")
}

fn find_free_port() -> u16 {
    if TcpListener::bind("127.0.0.1:14280").is_ok() {
        return 14280;
    }
    TcpListener::bind("127.0.0.1:0")
        .and_then(|l| l.local_addr())
        .map(|a| a.port())
        .unwrap_or(14280)
}

fn mime_for_path(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or_default()
        .to_lowercase()
        .as_str()
    {
        "html" => "text/html; charset=utf-8",
        "js" | "mjs" => "application/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" => "application/json; charset=utf-8",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "ico" => "image/x-icon",
        "woff2" => "font/woff2",
        "woff" => "font/woff",
        "ttf" => "font/ttf",
        _ => "application/octet-stream",
    }
}

const GTK_WEBKIT_SCRIPT: &str = r#"
import sys
import os
import gi
gi.require_version('Gtk', '3.0')
gi.require_version('WebKit2', '4.1')
from gi.repository import Gtk, WebKit2, Gdk, GLib

url = sys.argv[1]
GLib.set_prgname('rys-md')
GLib.set_application_name('Rys MD')

win = Gtk.Window(title='Rys MD')
win.set_default_size(1360, 860)
win.set_position(Gtk.WindowPosition.CENTER)
win.set_decorated(False)
win.set_app_paintable(True)
screen = win.get_screen()
visual = screen.get_rgba_visual()
if visual is not None and screen.is_composited():
    win.set_visual(visual)

for icon_path in [
    '/usr/share/icons/hicolor/128x128/apps/rys-md.png',
    '/usr/share/icons/hicolor/256x256/apps/rys-md.png',
]:
    if os.path.exists(icon_path):
        try:
            win.set_icon_from_file(icon_path)
            break
        except Exception:
            pass

data_dir = os.path.expanduser('~/.local/share/rys-md/webkit-data')
cache_dir = os.path.expanduser('~/.local/share/rys-md/webkit-cache')
os.makedirs(data_dir, exist_ok=True)
os.makedirs(cache_dir, exist_ok=True)

data_manager = WebKit2.WebsiteDataManager(
    base_data_directory=data_dir,
    base_cache_directory=cache_dir
)
context = WebKit2.WebContext.new_with_website_data_manager(data_manager)

ucm = WebKit2.UserContentManager()
script = WebKit2.UserScript.new(
    'window.__RYS_NATIVE_GTK__ = true;',
    WebKit2.UserContentInjectedFrames.TOP_FRAME,
    WebKit2.UserScriptInjectionTime.START,
    None,
    None
)
ucm.add_script(script)

wv = WebKit2.WebView.new_with_context(context)
wv.set_background_color(Gdk.RGBA(0, 0, 0, 0))
settings = wv.get_settings()
settings.set_enable_javascript(True)
settings.set_javascript_can_access_clipboard(True)
settings.set_enable_write_console_messages_to_stdout(False)
settings.set_enable_developer_extras(True)

last_press = {'button': 1, 'rx': 0, 'ry': 0, 'time': 0}

def get_resize_edge(w, x, y):
    alloc = w.get_allocation()
    width, height = alloc.width, alloc.height
    border = 6
    left = x < border
    right = x >= width - border
    top = y < border
    bottom = y >= height - border
    if top and left: return Gdk.WindowEdge.NORTH_WEST
    if top and right: return Gdk.WindowEdge.NORTH_EAST
    if bottom and left: return Gdk.WindowEdge.SOUTH_WEST
    if bottom and right: return Gdk.WindowEdge.SOUTH_EAST
    if left: return Gdk.WindowEdge.WEST
    if right: return Gdk.WindowEdge.EAST
    if top: return Gdk.WindowEdge.NORTH
    if bottom: return Gdk.WindowEdge.SOUTH
    return None

def on_button_press(widget, event):
    if event.button == 1:
        last_press['button'] = event.button
        last_press['rx'] = int(event.x_root)
        last_press['ry'] = int(event.y_root)
        last_press['time'] = event.time
        if not win.is_maximized():
            edge = get_resize_edge(win, event.x, event.y)
            if edge is not None:
                win.begin_resize_drag(edge, event.button, int(event.x_root), int(event.y_root), event.time)
                return True
    return False

wv.connect('button-press-event', on_button_press)

def on_permission_request(webview, request):
    request.allow()
    return True

wv.connect('permission-request', on_permission_request)

def on_title_changed(webview, param):
    title = webview.get_title() or ''
    if not title.startswith('__RYS_WIN_CMD__:'):
        return
    parts = title.split(':')
    cmd = parts[1] if len(parts) > 1 else ''
    if cmd == 'close':
        win.close()
        Gtk.main_quit()
    elif cmd == 'minimize':
        win.iconify()
    elif cmd == 'maximize':
        if win.is_maximized():
            win.unmaximize()
        else:
            win.maximize()
    elif cmd == 'drag':
        if not win.is_maximized():
            win.begin_move_drag(
                last_press['button'],
                last_press['rx'],
                last_press['ry'],
                last_press['time']
            )

wv.connect('notify::title', on_title_changed)
win.connect('destroy', Gtk.main_quit)

win.add(wv)
wv.load_uri(url)
win.show_all()
wv.run_javascript('window.__RYS_NATIVE_GTK__ = true;', None, None, None)
Gtk.main()
"#;

fn spawn_app_window(url: &str) {
    let url_owned = url.to_string();
    std::thread::spawn(move || {
        // 1. Tenta abrir a janela nativa Linux (GTK3 + WebKit2GTK)
        let has_gtk_webkit = Command::new("/usr/bin/python3")
            .arg("-c")
            .arg("import gi; gi.require_version('Gtk', '3.0'); gi.require_version('WebKit2', '4.1'); from gi.repository import Gtk, WebKit2")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false);

        if has_gtk_webkit {
            if let Ok(mut child) = Command::new("/usr/bin/python3")
                .arg("-c")
                .arg(GTK_WEBKIT_SCRIPT)
                .arg(&url_owned)
                .spawn()
            {
                let _ = child.wait();
                std::process::exit(0);
            }
        }

        // 2. Fallback: navegadores reais instalados em /usr/bin
        let browsers = [
            "/usr/bin/google-chrome-stable",
            "/usr/bin/brave-browser",
            "/usr/bin/microsoft-edge-stable",
            "/snap/bin/chromium",
        ];
        for bin in browsers {
            if Path::new(bin).is_file() {
                if let Ok(mut child) = Command::new(bin)
                    .arg(format!("--app={url_owned}"))
                    .arg("--window-size=1360,860")
                    .arg("--class=rys-md")
                    .spawn()
                {
                    let _ = child.wait();
                    return;
                }
            }
        }
        let _ = Command::new("xdg-open").arg(&url_owned).spawn();
    });
}

fn main() {
    let dist_dir = find_dist_dir();
    let port = find_free_port();
    let addr = format!("127.0.0.1:{port}");
    let server = Server::http(&addr).expect("Falha ao iniciar servidor local Rys MD");

    let app_url = format!("http://{addr}");
    println!("🚀 Rys MD rodando em {app_url}");
    spawn_app_window(&app_url);

    for mut request in server.incoming_requests() {
        let raw_url = format!("http://localhost{}", request.url());
        let parsed = Url::parse(&raw_url).unwrap_or_else(|_| Url::parse("http://localhost/").unwrap());
        let pathname = parsed.path().to_string();

        if request.method() == &Method::Get && pathname == "/api/vault/asset" {
            let mut vault_param = None;
            let mut rel_param = String::new();
            for (k, v) in parsed.query_pairs() {
                if k == "vaultPath" {
                    vault_param = Some(v.to_string());
                } else if k == "path" {
                    rel_param = v.to_string();
                }
            }
            let dir = resolve_vault_dir(vault_param);
            let abs = dir.join(rel_param);
            if let Ok(bytes) = fs::read(&abs) {
                let header = Header::from_bytes("Content-Type", mime_for_path(&abs)).unwrap();
                let _ = request.respond(Response::from_data(bytes).with_header(header));
            } else {
                let _ = request.respond(Response::empty(StatusCode(404)));
            }
            continue;
        }

        if request.method() == &Method::Post && pathname.starts_with("/api/vault/") {
            let mut content = String::new();
            let _ = request.as_reader().read_to_string(&mut content);
            let body: serde_json::Value =
                serde_json::from_str(&content).unwrap_or_else(|_| serde_json::json!({}));
            let header = Header::from_bytes("Content-Type", "application/json").unwrap();
            match handle_api_post(&pathname, &body) {
                Ok(val) => {
                    let payload = serde_json::to_string(&val).unwrap_or_default();
                    let _ = request.respond(Response::from_string(payload).with_header(header));
                }
                Err(err) => {
                    let payload = serde_json::json!({ "error": err }).to_string();
                    let _ = request.respond(
                        Response::from_string(payload)
                            .with_status_code(StatusCode(500))
                            .with_header(header),
                    );
                }
            }
            continue;
        }

        // Serve static files from dist_dir
        let rel_req = pathname.trim_start_matches('/');
        let file_path = if rel_req.is_empty() {
            dist_dir.join("index.html")
        } else {
            dist_dir.join(rel_req)
        };

        let target = if file_path.is_file() {
            file_path
        } else {
            dist_dir.join("index.html")
        };

        if let Ok(bytes) = fs::read(&target) {
            let header = Header::from_bytes("Content-Type", mime_for_path(&target)).unwrap();
            let _ = request.respond(Response::from_data(bytes).with_header(header));
        } else {
            let _ = request.respond(Response::empty(StatusCode(404)));
        }
    }
}

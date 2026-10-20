#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeSet, HashMap};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
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
    format!("note-{created}-{:x}", md5_like_hash(rel_path))
}

fn md5_like_hash(s: &str) -> u64 {
    let mut h: u64 = 0xcbf29ce484222325;
    for b in s.bytes() {
        h ^= b as u64;
        h = h.wrapping_mul(0x100000001b3);
    }
    h
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

    // Modo PortableApps (Windows / Pendrive / Pasta Portátil):
    // Se existir a pasta "Rys MD Vault" ou o marcador "portable.txt" ao lado do executável,
    // grava todas as notas localmente dentro da própria pasta portátil.
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let portable_vault = exe_dir.join("Rys MD Vault");
            let portable_marker = exe_dir.join("portable.txt");
            if portable_vault.is_dir() || portable_marker.is_file() {
                return portable_vault;
            }
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
        if preview.is_empty() && !line.starts_with("<details") && !line.starts_with("</details") && !line.starts_with("<summary") {
            preview = line
                .replace("**", "")
                .replace("__", "")
                .replace('`', "");
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
        if !is_trash {
            if rel.split('/').any(|p| p.starts_with('.')) {
                continue;
            }
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

#[tauri::command]
fn scan_vault(vault_path: Option<String>) -> Result<VaultState, String> {
    let dir = resolve_vault_dir(vault_path);
    build_vault_state(&dir)
}

#[tauri::command]
fn save_note(
    vault_path: Option<String>,
    relative_path: String,
    content: String,
    auto_rename: Option<bool>,
) -> Result<serde_json::Value, String> {
    let dir = resolve_vault_dir(vault_path);
    let current_abs = dir.join(&relative_path);
    if let Some(parent) = current_abs.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&current_abs, &content).map_err(|e| e.to_string())?;

    let mut final_rel = relative_path.clone();
    let mut index = read_index(&dir);

    if auto_rename.unwrap_or(true) && !relative_path.starts_with(".trash/") {
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
            if unique_rel != relative_path && fs::rename(&current_abs, dir.join(&unique_rel)).is_ok() {
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

#[tauri::command]
fn create_note(
    vault_path: Option<String>,
    folder: Option<String>,
    initial_content: Option<String>,
) -> Result<serde_json::Value, String> {
    let dir = resolve_vault_dir(vault_path);
    let folder_clean = folder.unwrap_or_default().trim_matches('/').to_string();
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
    let body = initial_content.unwrap_or_else(|| format!("# {stem}\n\n"));
    fs::write(dir.join(&rel_path), body).map_err(|e| e.to_string())?;

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

#[tauri::command]
fn toggle_pin(
    vault_path: Option<String>,
    relative_path: String,
) -> Result<serde_json::Value, String> {
    let dir = resolve_vault_dir(vault_path);
    let mut index = read_index(&dir);
    let entry = index.notes.entry(relative_path).or_default();
    entry.pinned = !entry.pinned;
    write_index(&dir, &index);

    let state = build_vault_state(&dir)?;
    Ok(serde_json::json!({ "state": state }))
}

#[tauri::command]
fn trash_note(
    vault_path: Option<String>,
    relative_path: String,
) -> Result<serde_json::Value, String> {
    let dir = resolve_vault_dir(vault_path);
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

#[tauri::command]
fn restore_note(
    vault_path: Option<String>,
    relative_path: String,
) -> Result<serde_json::Value, String> {
    let dir = resolve_vault_dir(vault_path);
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

#[tauri::command]
fn move_note(
    vault_path: Option<String>,
    relative_path: String,
    target_folder: String,
) -> Result<serde_json::Value, String> {
    let dir = resolve_vault_dir(vault_path);
    let folder_clean = target_folder.trim_matches('/').to_string();
    let base_name = Path::new(&relative_path)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("Nota.md");

    let dest_rel = if folder_clean.is_empty() {
        base_name.to_string()
    } else {
        let _ = fs::create_dir_all(dir.join(&folder_clean));
        format!("{folder_clean}/{base_name}")
    };

    if dest_rel != relative_path {
        fs::rename(dir.join(&relative_path), dir.join(&dest_rel)).map_err(|e| e.to_string())?;
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

#[tauri::command]
fn create_folder(
    vault_path: Option<String>,
    folder_path: String,
) -> Result<serde_json::Value, String> {
    let dir = resolve_vault_dir(vault_path);
    let clean = folder_path.trim_matches('/').to_string();
    if !clean.is_empty() {
        fs::create_dir_all(dir.join(&clean)).map_err(|e| e.to_string())?;
    }
    let state = build_vault_state(&dir)?;
    Ok(serde_json::json!({
        "createdFolder": clean,
        "state": state
    }))
}

#[tauri::command]
fn delete_folder(
    vault_path: Option<String>,
    folder_path: String,
) -> Result<serde_json::Value, String> {
    let dir = resolve_vault_dir(vault_path);
    let clean = folder_path.trim_matches('/').to_string();
    let target = dir.join(&clean);
    if target.exists() {
        let _ = fs::remove_dir_all(target);
    }
    let state = build_vault_state(&dir)?;
    Ok(serde_json::json!({ "state": state }))
}

#[tauri::command]
fn save_asset(
    vault_path: Option<String>,
    file_name: String,
    base64_data: String,
) -> Result<serde_json::Value, String> {
    let dir = resolve_vault_dir(vault_path);
    let assets_dir = dir.join("assets");
    fs::create_dir_all(&assets_dir).map_err(|e| e.to_string())?;

    let clean_payload = base64_data
        .split(',')
        .next_back()
        .unwrap_or(&base64_data);
    let bytes = BASE64.decode(clean_payload).map_err(|e| e.to_string())?;

    let safe_name = sanitize_filename(&file_name);
    let stamped = format!("{}-{}", now_millis(), safe_name);
    let rel_asset = format!("assets/{stamped}");
    fs::write(dir.join(&rel_asset), bytes).map_err(|e| e.to_string())?;

    Ok(serde_json::json!({
        "relativeAssetPath": rel_asset
    }))
}

#[tauri::command]
fn read_asset_base64(
    vault_path: Option<String>,
    relative_path: String,
) -> Result<serde_json::Value, String> {
    let dir = resolve_vault_dir(vault_path);
    let abs = dir.join(&relative_path);
    let bytes = fs::read(&abs).map_err(|e| e.to_string())?;
    let ext = abs
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("png")
        .to_lowercase();
    let mime = match ext.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        _ => "image/png",
    };
    let b64 = BASE64.encode(&bytes);
    Ok(serde_json::json!({
        "dataUrl": format!("data:{mime};base64,{b64}")
    }))
}

#[tauri::command]
fn reveal_in_folder(
    vault_path: Option<String>,
    relative_path: Option<String>,
) -> Result<(), String> {
    let dir = resolve_vault_dir(vault_path);
    let target = if let Some(rel) = relative_path {
        let abs = dir.join(rel);
        abs.parent().map(|p| p.to_path_buf()).unwrap_or(dir)
    } else {
        dir
    };

    #[cfg(target_os = "windows")]
    let _ = Command::new("explorer").arg(target).spawn();

    #[cfg(target_os = "macos")]
    let _ = Command::new("open").arg(target).spawn();

    #[cfg(target_os = "linux")]
    let _ = Command::new("xdg-open").arg(target).spawn();

    Ok(())
}

#[tauri::command]
fn open_markdown_file(vault_path: Option<String>) -> Result<serde_json::Value, String> {
    let dir = resolve_vault_dir(vault_path);

    #[cfg(target_os = "linux")]
    let chosen_path = {
        let picker_script = r#"
import sys, os
try:
    import gi
    gi.require_version('Gtk', '3.0')
    from gi.repository import Gtk
    dialog = Gtk.FileChooserDialog(
        title='Abrir arquivo Markdown — Rys MD',
        parent=None,
        action=Gtk.FileChooserAction.OPEN
    )
    dialog.add_buttons(
        Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
        Gtk.STOCK_OPEN, Gtk.ResponseType.ACCEPT
    )
    docs_dir = os.path.expanduser('~/Documentos')
    if not os.path.isdir(docs_dir):
        docs_dir = os.path.expanduser('~')
    dialog.set_current_folder(docs_dir)
    info_label = Gtk.Label(
        label='ℹ️ Ao abrir um arquivo .md, uma cópia será criada automaticamente na sua pasta padrão do Rys MD.'
    )
    info_label.set_margin_top(6)
    info_label.set_margin_bottom(6)
    info_label.show()
    dialog.set_extra_widget(info_label)
    md_filter = Gtk.FileFilter()
    md_filter.set_name('Arquivos Markdown (*.md, *.markdown, *.txt)')
    md_filter.add_pattern('*.md')
    md_filter.add_pattern('*.MD')
    md_filter.add_pattern('*.markdown')
    md_filter.add_pattern('*.txt')
    dialog.add_filter(md_filter)
    res = dialog.run()
    chosen = dialog.get_filename() if res == Gtk.ResponseType.ACCEPT else ''
    dialog.destroy()
    while Gtk.events_pending():
        Gtk.main_iteration()
    if chosen:
        print(chosen)
except Exception:
    pass
"#;
        let out = Command::new("/usr/bin/python3")
            .arg("-c")
            .arg(picker_script)
            .output()
            .map_err(|e| e.to_string())?;
        String::from_utf8_lossy(&out.stdout).trim().to_string()
    };

    #[cfg(target_os = "macos")]
    let chosen_path = {
        let out = Command::new("osascript")
            .args([
                "-e",
                "try\nPOSIX path of (choose file of type {\"md\", \"markdown\", \"txt\", \"public.plain-text\"} with prompt \"Selecione um arquivo Markdown (uma cópia será criada na pasta padrão do Rys MD):\")\nend try",
            ])
            .output()
            .map_err(|e| e.to_string())?;
        String::from_utf8_lossy(&out.stdout).trim().to_string()
    };

    #[cfg(target_os = "windows")]
    let chosen_path = {
        let ps_script = "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.OpenFileDialog; $f.Title = 'Abrir arquivo Markdown (uma copia sera salva na pasta padrao do Rys MD)'; $f.Filter = 'Arquivos Markdown (*.md;*.markdown;*.txt)|*.md;*.markdown;*.txt|Todos os arquivos (*.*)|*.*'; if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $f.FileName }";
        let out = Command::new("powershell")
            .args(["-NoProfile", "-Command", ps_script])
            .output()
            .map_err(|e| e.to_string())?;
        String::from_utf8_lossy(&out.stdout).trim().to_string()
    };

    if chosen_path.is_empty() {
        return Ok(serde_json::json!({ "cancelled": true }));
    }

    let src_path = PathBuf::from(&chosen_path);
    let raw_bytes = fs::read(&src_path).map_err(|e| e.to_string())?;
    let file_content = String::from_utf8_lossy(&raw_bytes).to_string();

    let raw_stem = src_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Nota Importada");
    let safe_stem = sanitize_filename(raw_stem);

    let mut candidate_rel = format!("{safe_stem}.md");
    let mut counter = 1usize;
    while dir.join(&candidate_rel).exists() {
        if counter == 1 {
            candidate_rel = format!("{safe_stem} (Cópia).md");
        } else {
            candidate_rel = format!("{safe_stem} (Cópia {counter}).md");
        }
        counter += 1;
    }

    fs::write(dir.join(&candidate_rel), &file_content).map_err(|e| e.to_string())?;

    let mut index = read_index(&dir);
    let now = now_millis();
    index.notes.insert(
        candidate_rel.clone(),
        NoteMetaEntry {
            id: Some(format!("note-{now}")),
            pinned: false,
            created_at: Some(now),
            updated_at: Some(now),
            original_folder: None,
        },
    );
    write_index(&dir, &index);

    let state = build_vault_state(&dir)?;
    Ok(serde_json::json!({
        "cancelled": false,
        "importedRelativePath": candidate_rel,
        "fileName": candidate_rel,
        "vaultPath": state.vault_path,
        "copied": true,
        "state": state
    }))
}

#[tauri::command]
fn window_action(window: tauri::Window, action: String) -> Result<serde_json::Value, String> {
    match action.as_str() {
        "minimize" => {
            let _ = window.minimize();
        }
        "maximize" => {
            if window.is_maximized().unwrap_or(false) {
                let _ = window.unmaximize();
            } else {
                let _ = window.maximize();
            }
        }
        "close" => {
            let _ = window.close();
        }
        "drag" => {
            let _ = window.start_dragging();
        }
        _ => {}
    }
    Ok(serde_json::json!({ "ok": true }))
}

#[tauri::command]
fn open_external_url(url: String) -> Result<serde_json::Value, String> {
    #[cfg(target_os = "windows")]
    let _ = Command::new("cmd").args(["/C", "start", "", &url]).spawn();

    #[cfg(target_os = "macos")]
    let _ = Command::new("open").arg(&url).spawn();

    #[cfg(target_os = "linux")]
    let _ = Command::new("xdg-open").arg(&url).spawn();

    Ok(serde_json::json!({ "ok": true }))
}

#[tauri::command]
fn open_os_emoji() -> Result<serde_json::Value, String> {
    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("osascript")
            .args([
                "-e",
                "tell application \"System Events\" to keystroke \" \" using {command down, control down}",
            ])
            .spawn();
    }

    #[cfg(target_os = "windows")]
    {
        let ps = "$wshell = New-Object -ComObject wscript.shell; $wshell.SendKeys('^{ESC}')";
        let _ = Command::new("powershell")
            .args(["-NoProfile", "-Command", ps])
            .spawn();
    }

    #[cfg(target_os = "linux")]
    {
        let _ = Command::new("sh")
            .arg("-c")
            .arg("gnome-characters || plasma-emojier || emote || ibus emoji || true")
            .spawn();
    }

    Ok(serde_json::json!({ "ok": true }))
}

#[tauri::command]
fn export_pdf(
    default_file_name: String,
    _title: Option<String>,
    html: String,
) -> Result<serde_json::Value, String> {
    let tmp_html = std::env::temp_dir().join("rys-md-export-a4.html");
    fs::write(&tmp_html, &html).map_err(|e| e.to_string())?;

    #[cfg(target_os = "macos")]
    let chosen_path = {
        let safe_name = default_file_name.replace('"', "");
        let script = format!(
            "try\nPOSIX path of (choose file name with prompt \"Exportar para PDF (A4):\" default name \"{safe_name}\")\nend try"
        );
        let out = Command::new("osascript")
            .args(["-e", &script])
            .output()
            .map_err(|e| e.to_string())?;
        let mut s = String::from_utf8_lossy(&out.stdout).trim().to_string();
        if !s.is_empty() && !s.to_lowercase().ends_with(".pdf") {
            s.push_str(".pdf");
        }
        s
    };

    #[cfg(target_os = "windows")]
    let chosen_path = {
        let safe_name = default_file_name.replace('\'', "");
        let ps_script = format!(
            "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.SaveFileDialog; $f.Title = 'Exportar para PDF (A4)'; $f.FileName = '{safe_name}'; $f.Filter = 'Documento PDF (*.pdf)|*.pdf'; if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {{ Write-Output $f.FileName }}"
        );
        let out = Command::new("powershell")
            .args(["-NoProfile", "-Command", &ps_script])
            .output()
            .map_err(|e| e.to_string())?;
        String::from_utf8_lossy(&out.stdout).trim().to_string()
    };

    #[cfg(target_os = "linux")]
    let chosen_path = {
        let picker_script = r#"
import sys, os
try:
    import gi
    gi.require_version('Gtk', '3.0')
    from gi.repository import Gtk
    dialog = Gtk.FileChooserDialog(title='Exportar para PDF (A4)', parent=None, action=Gtk.FileChooserAction.SAVE)
    dialog.add_buttons(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL, Gtk.STOCK_SAVE, Gtk.ResponseType.ACCEPT)
    dialog.set_do_overwrite_confirmation(True)
    dialog.set_current_name(sys.argv[1])
    res = dialog.run()
    chosen = dialog.get_filename() if res == Gtk.ResponseType.ACCEPT else ''
    dialog.destroy()
    if chosen:
        if not chosen.lower().endswith('.pdf'): chosen += '.pdf'
        print(chosen)
except Exception:
    pass
"#;
        let out = Command::new("/usr/bin/python3")
            .arg("-c")
            .arg(picker_script)
            .arg(&default_file_name)
            .output()
            .map_err(|e| e.to_string())?;
        String::from_utf8_lossy(&out.stdout).trim().to_string()
    };

    if chosen_path.is_empty() {
        return Ok(serde_json::json!({ "ok": false, "cancelled": true }));
    }

    #[cfg(target_os = "macos")]
    let browsers = [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ];

    #[cfg(target_os = "windows")]
    let browsers = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe",
    ];

    #[cfg(target_os = "linux")]
    let browsers = [
        "/usr/bin/google-chrome-stable",
        "/usr/bin/google-chrome",
        "/usr/bin/brave-browser",
        "/usr/bin/microsoft-edge-stable",
        "/usr/bin/chromium",
        "/snap/bin/chromium",
    ];

    for bin in browsers {
        if Path::new(bin).is_file() {
            let status = Command::new(bin)
                .arg("--headless")
                .arg("--disable-gpu")
                .arg("--no-pdf-header-footer")
                .arg(format!("--print-to-pdf={chosen_path}"))
                .arg(tmp_html.to_string_lossy().to_string())
                .status();
            if status.map(|s| s.success()).unwrap_or(false) && Path::new(&chosen_path).is_file() {
                return Ok(serde_json::json!({ "ok": true, "savedPath": chosen_path }));
            }
        }
    }

    Err("Browser PDF engine unavailable; fallback to window.print()".to_string())
}

#[tauri::command]
fn check_update(_current_version: String) -> Result<serde_json::Value, String> {
    // Throw so vault-client.ts uses its built-in cross-platform fetch() against GitHub Releases API
    Err("use_js_github_fetch".to_string())
}

#[tauri::command]
fn perform_update(
    download_url: Option<String>,
    _latest_version: Option<String>,
) -> Result<serde_json::Value, String> {
    #[cfg(target_os = "macos")]
    {
        let script = r#"#!/bin/bash
set -e
TAR_URL="https://github.com/ronysimao/rys-md/releases/latest/download/Rys-MD_macOS_Universal.app.tar.gz"
TMP_DIR="$(mktemp -d)"
curl -fsSL "$TAR_URL" -o "$TMP_DIR/rys-md.app.tar.gz"
tar -xzf "$TMP_DIR/rys-md.app.tar.gz" -C "$TMP_DIR"
rm -rf "/Applications/Rys MD.app"
mv "$TMP_DIR/Rys MD.app" "/Applications/Rys MD.app"
xattr -cr "/Applications/Rys MD.app" || true
codesign --force --deep --sign - "/Applications/Rys MD.app" || true
rm -rf "$TMP_DIR"
killall "rys-md" "Rys MD" 2>/dev/null || true
sleep 0.5
open "/Applications/Rys MD.app"
"#;
        let script_path = std::env::temp_dir().join("rys-md-macos-updater.sh");
        let _ = fs::write(&script_path, script);
        let _ = Command::new("/bin/bash").arg(&script_path).spawn();
        return Ok(serde_json::json!({ "ok": true }));
    }

    #[cfg(target_os = "windows")]
    {
        let current_exe = std::env::current_exe()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();
        let pid = std::process::id();
        let url = download_url.unwrap_or_else(|| {
            "https://github.com/ronysimao/rys-md/releases/latest/download/Rys-MD_Windows_x64_Portable.exe".to_string()
        });
        let ps_updater = format!(
            "Start-Sleep -Milliseconds 300; $tmp = Join-Path $env:TEMP 'Rys-MD-Update-Portable.exe'; Invoke-WebRequest -Uri '{url}' -OutFile $tmp -UseBasicParsing; Unblock-File -Path $tmp -ErrorAction SilentlyContinue; Stop-Process -Id {pid} -Force -ErrorAction SilentlyContinue; Start-Sleep -Milliseconds 700; Copy-Item -Path $tmp -Destination '{current_exe}' -Force; Unblock-File -Path '{current_exe}' -ErrorAction SilentlyContinue; Start-Process -FilePath '{current_exe}'"
        );
        let _ = Command::new("powershell")
            .args([
                "-NoProfile",
                "-WindowStyle",
                "Hidden",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                &ps_updater,
            ])
            .spawn();
        return Ok(serde_json::json!({ "ok": true }));
    }

    #[cfg(target_os = "linux")]
    {
        let _ = download_url;
        return Err("open_release_url".to_string());
    }
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            use tauri::Manager;
            if let Some(window) = app.get_webview_window("main") {
                let monitor_opt = window
                    .current_monitor()
                    .ok()
                    .flatten()
                    .or_else(|| window.primary_monitor().ok().flatten());
                if let Some(monitor) = monitor_opt {
                    let screen = monitor.size();
                    let scale = monitor.scale_factor();
                    let min_phys_w = (860.0 * scale).round() as u32;
                    let min_phys_h = (540.0 * scale).round() as u32;
                    let target_w = (((screen.width as f64) * 0.80).round() as u32).max(min_phys_w);
                    let target_h = (((screen.height as f64) * 0.80).round() as u32).max(min_phys_h);
                    if target_w > 0 && target_h > 0 {
                        let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
                            width: target_w,
                            height: target_h,
                        }));
                    }
                }
                let _ = window.center();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            scan_vault,
            save_note,
            create_note,
            toggle_pin,
            trash_note,
            restore_note,
            move_note,
            create_folder,
            delete_folder,
            save_asset,
            read_asset_base64,
            reveal_in_folder,
            open_markdown_file,
            export_pdf,
            check_update,
            perform_update,
            open_external_url,
            open_os_emoji,
            window_action
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

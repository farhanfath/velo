use crate::models::{ParsedEntryDraft, VaultStatus};
use crate::parser::{parse_bulk_text, parse_entry_text};
pub use crate::state::VaultSnapshotResponse;
use crate::state::AppState;
use std::path::Path;
use std::time::Duration;
use tauri_plugin_clipboard_manager::ClipboardExt;
use zeroize::Zeroizing;

#[tauri::command]
pub async fn get_vault_status(state: tauri::State<'_, AppState>) -> Result<VaultStatus, String> {
    let app_state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _ = app_state.check_idle_and_lock();
        Ok(app_state.status())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn init_or_unlock_vault(
    state: tauri::State<'_, AppState>,
    master_password: String,
    custom_path: Option<String>,
) -> Result<VaultSnapshotResponse, String> {
    let app_state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        app_state.unlock_or_init(&master_password, custom_path.as_deref())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn lock_vault(state: tauri::State<'_, AppState>) -> Result<VaultStatus, String> {
    let app_state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        app_state.lock();
        Ok(app_state.status())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn enable_windows_hello(
    window: tauri::WebviewWindow,
    state: tauri::State<'_, AppState>,
    master_password: Option<String>,
) -> Result<VaultStatus, String> {
    #[cfg(target_os = "windows")]
    let hwnd = window.hwnd().ok().map(|h| h.0 as isize);
    #[cfg(not(target_os = "windows"))]
    let hwnd: Option<isize> = None;

    let app_state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        app_state.enable_windows_hello(master_password.as_deref(), hwnd)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn disable_windows_hello(state: tauri::State<'_, AppState>) -> Result<VaultStatus, String> {
    let app_state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        app_state.disable_windows_hello()
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn unlock_with_windows_hello(
    window: tauri::WebviewWindow,
    state: tauri::State<'_, AppState>,
    custom_path: Option<String>,
) -> Result<VaultSnapshotResponse, String> {
    #[cfg(target_os = "windows")]
    let hwnd = window.hwnd().ok().map(|h| h.0 as isize);
    #[cfg(not(target_os = "windows"))]
    let hwnd: Option<isize> = None;

    let app_state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        app_state.unlock_with_windows_hello(custom_path.as_deref(), hwnd)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn parse_preview(raw_text: String) -> Result<Option<ParsedEntryDraft>, String> {
    Ok(parse_entry_text(&raw_text))
}

#[tauri::command]
pub fn parse_bulk_preview(raw_bulk: String) -> Result<Vec<ParsedEntryDraft>, String> {
    Ok(parse_bulk_text(&raw_bulk))
}

#[tauri::command]
pub fn upsert_entry_from_raw(
    state: tauri::State<'_, AppState>,
    id: Option<String>,
    raw_text: String,
    favorite: Option<bool>,
) -> Result<VaultSnapshotResponse, String> {
    state.upsert_raw(id, &raw_text, favorite)
}

#[tauri::command]
pub fn bulk_import_from_raw(
    state: tauri::State<'_, AppState>,
    raw_bulk: String,
) -> Result<VaultSnapshotResponse, String> {
    state.bulk_import_raw(&raw_bulk)
}

#[tauri::command]
pub fn delete_entry(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<VaultSnapshotResponse, String> {
    state.delete_entry_by_id(&id)
}

#[tauri::command]
pub fn toggle_favorite(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<VaultSnapshotResponse, String> {
    state.toggle_favorite_by_id(&id)
}

#[tauri::command]
pub fn query_vault(
    state: tauri::State<'_, AppState>,
    query: String,
    email_filter: Option<String>,
    tag_filter: Option<String>,
    favorites_only: bool,
) -> Result<VaultSnapshotResponse, String> {
    state.query(
        &query,
        email_filter.as_deref(),
        tag_filter.as_deref(),
        favorites_only,
    )
}

#[tauri::command]
pub fn update_auto_lock_minutes(
    state: tauri::State<'_, AppState>,
    minutes: u32,
) -> Result<VaultStatus, String> {
    state.set_auto_lock_minutes(minutes)
}

#[tauri::command]
pub async fn change_master_password(
    state: tauri::State<'_, AppState>,
    current_password: String,
    new_password: String,
) -> Result<VaultStatus, String> {
    let app_state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        app_state.change_master_password(&current_password, &new_password)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn export_vault_backup(
    state: tauri::State<'_, AppState>,
    destination_path: String,
) -> Result<(), String> {
    let app_state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        app_state.export_backup(Path::new(&destination_path))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn restore_vault_backup(
    state: tauri::State<'_, AppState>,
    source_path: String,
    master_password: String,
) -> Result<VaultSnapshotResponse, String> {
    let app_state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        app_state.restore_backup(Path::new(&source_path), &master_password)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn recover_from_bak(
    state: tauri::State<'_, AppState>,
    master_password: String,
) -> Result<VaultSnapshotResponse, String> {
    let app_state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        app_state.recover_backup(&master_password)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn copy_to_clipboard(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    value: String,
    is_secret: bool,
) -> Result<(), String> {
    state.touch();
    app.clipboard()
        .write_text(value.clone())
        .map_err(|e| format!("Gagal menyalin ke clipboard: {e}"))?;

    if is_secret {
        let app_handle = app.clone();
        let expected = Zeroizing::new(value);
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_secs(30));
            if let Ok(current) = app_handle.clipboard().read_text() {
                if current == expected.as_str() {
                    let _ = app_handle.clipboard().write_text("");
                }
            }
        });
    }

    Ok(())
}

#[tauri::command]
pub async fn set_window_display_mode(
    window: tauri::WebviewWindow,
    mode: String,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        if mode == "spotlight" {
            let _ = window.set_resizable(false);
            let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize {
                width: 640.0,
                height: 420.0,
            }));
            let _ = window.center();
            let _ = window.show();
            let _ = window.unminimize();
            let _ = window.set_focus();
        } else {
            let _ = window.set_resizable(true);
            let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize {
                width: 1160.0,
                height: 760.0,
            }));
            let _ = window.center();
            let _ = window.show();
            let _ = window.unminimize();
            let _ = window.set_focus();
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn hide_window(window: tauri::WebviewWindow) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let _ = window.hide();
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_parse_preview_and_bulk_preview_commands() {
        let single = parse_preview("amazon video\nemail: test:@gmail.com\npass: test123".into())
            .expect("ok")
            .expect("some draft");
        assert_eq!(single.title, "amazon video");
        assert_eq!(single.fields.len(), 2);

        let bulk = parse_bulk_preview("xbox\npass: 123\n\nsteam #game\npass: 456".into())
            .expect("bulk ok");
        assert_eq!(bulk.len(), 2);
        assert_eq!(bulk[1].tags, vec!["game".to_string()]);
    }

    #[test]
    fn test_upsert_update_existing_entry_and_persistence() {
        let dir = tempdir().expect("tempdir");
        let vault_path = dir.path().join("cmd.vault");
        let state = AppState::new(vault_path.clone());

        state.unlock_or_init("master123", None).expect("init");
        let created = state
            .upsert_raw(None, "netflix\nemail: a@b.com\npass: oldpass", Some(false))
            .expect("create");
        let entry_id = created.entries[0].id.clone();

        let updated = state
            .upsert_raw(
                Some(entry_id.clone()),
                "netflix premium # entertainment\nemail: a@b.com\npass: newpass99",
                Some(true),
            )
            .expect("update");
        assert_eq!(updated.entries.len(), 1);
        assert_eq!(updated.entries[0].id, entry_id);
        assert_eq!(updated.entries[0].title, "netflix premium # entertainment");
        assert_eq!(updated.entries[0].fields[1].value, "newpass99");
        assert!(updated.entries[0].favorite);

        // Lock and re-unlock with wrong password vs right password
        state.lock();
        assert!(state.unlock_or_init("wrongpass", None).is_err());
        let reopened = state.unlock_or_init("master123", None).expect("reopen");
        assert_eq!(reopened.entries.len(), 1);
        assert_eq!(reopened.entries[0].fields[1].value, "newpass99");
    }
}

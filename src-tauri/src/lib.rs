pub mod commands;
pub mod crypto;
pub mod models;
pub mod parser;
pub mod search;
pub mod state;
pub mod storage;
pub mod winhello;

use crate::state::AppState;
use std::path::PathBuf;
use std::time::Duration;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager, WindowEvent};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

fn toggle_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let visible = window.is_visible().unwrap_or(false);
        let minimized = window.is_minimized().unwrap_or(false);
        if visible && !minimized {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.unminimize();
            let _ = window.set_focus();
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::Space);

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, registered_shortcut, event| {
                    if registered_shortcut == &shortcut && event.state() == ShortcutState::Pressed {
                        toggle_main_window(app);
                    }
                })
                .build(),
        )
        .setup(move |app| {
            let base_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")));
            let default_vault_path = base_dir.join("storage-local.vault");
            app.manage(AppState::new(default_vault_path));

            let show_hide_item = MenuItem::with_id(
                app,
                "show_hide",
                "Tampilkan / Sembunyikan",
                true,
                None::<&str>,
            )?;
            let lock_now_item = MenuItem::with_id(
                app,
                "lock_now",
                "Kunci Vault Sekarang",
                true,
                None::<&str>,
            )?;
            let quit_item = MenuItem::with_id(app, "quit", "Keluar", true, None::<&str>)?;
            let tray_menu = Menu::with_items(app, &[&show_hide_item, &lock_now_item, &quit_item])?;

            let mut tray_builder = TrayIconBuilder::new()
                .tooltip("Velo — Personal Credential Vault")
                .menu(&tray_menu)
                .on_menu_event(|app_handle, event| match event.id.as_ref() {
                    "show_hide" => {
                        toggle_main_window(app_handle);
                    }
                    "lock_now" => {
                        if let Some(state) = app_handle.try_state::<AppState>() {
                            state.lock();
                            let _ = app_handle.emit("vault://locked", ());
                        }
                    }
                    "quit" => {
                        if let Some(state) = app_handle.try_state::<AppState>() {
                            state.lock();
                        }
                        app_handle.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_main_window(tray.app_handle());
                    }
                });

            if let Some(default_icon) = app.default_window_icon().cloned() {
                tray_builder = tray_builder.icon(default_icon);
            }
            let _ = tray_builder.build(app)?;

            let _ = app.global_shortcut().register(shortcut);

            let watcher_handle = app.handle().clone();
            std::thread::spawn(move || loop {
                std::thread::sleep(Duration::from_secs(5));
                if let Some(state) = watcher_handle.try_state::<AppState>() {
                    if state.check_idle_and_lock() {
                        let _ = watcher_handle.emit("vault://locked", ());
                    }
                }
            });

            if std::env::args().any(|arg| arg == "--minimized") {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_vault_status,
            commands::init_or_unlock_vault,
            commands::lock_vault,
            commands::enable_windows_hello,
            commands::disable_windows_hello,
            commands::unlock_with_windows_hello,
            commands::parse_preview,
            commands::parse_bulk_preview,
            commands::upsert_entry_from_raw,
            commands::bulk_import_from_raw,
            commands::delete_entry,
            commands::toggle_favorite,
            commands::query_vault,
            commands::update_auto_lock_minutes,
            commands::change_master_password,
            commands::export_vault_backup,
            commands::restore_vault_backup,
            commands::recover_from_bak,
            commands::copy_to_clipboard,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

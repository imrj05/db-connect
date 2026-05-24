pub mod commands;
pub mod db;
pub mod import_export;
pub mod license;
pub mod monitoring;
pub mod sql_import;
pub mod ssh;
pub mod storage;
pub mod types;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Resolve the same directory Tauri's `app_data_dir()` would give us so
    // monitoring can load the user's persisted opt-in/out *before* the panic
    // hook is installed. Keep this in sync with `identifier` in tauri.conf.json.
    let prefs_dir = monitoring::default_data_dir("com.rajeshwar.db-connect");
    let _sentry_guard = monitoring::init(prefs_dir);

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("could not resolve app data dir");

            tauri::async_runtime::block_on(storage::AppStorage::init(data_dir.clone()))
                .expect("failed to initialise storage");

            license::init(data_dir);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // ── DB driver commands ─────────────────────────────────────────────
            commands::connect_database,
            commands::disconnect_database,
            commands::get_databases,
            commands::create_database,
            commands::get_tables,
            commands::execute_query,
            commands::ping_connection,
            commands::get_table_data,
            commands::list_all_tables,
            commands::get_user_databases,
            commands::get_table_structure,
            commands::get_schema_graph,
            commands::switch_database,
            commands::dump_database,
            commands::import_sql_file,
            // ── App info ──────────────────────────────────────────────────────
            commands::get_app_data_dir,
            monitoring::monitoring_set_preferences,
            monitoring::monitoring_capture_telemetry,
            // ── Storage commands ───────────────────────────────────────────────
            commands::storage_load_connections,
            commands::storage_save_connection,
            commands::storage_delete_connection,
            commands::storage_load_queries,
            commands::storage_save_query,
            commands::storage_delete_query,
            commands::storage_load_snippets,
            commands::storage_save_snippet,
            commands::storage_delete_snippet,
            commands::storage_save_workspace,
            commands::storage_load_workspace,
            commands::storage_load_history,
            commands::storage_save_history_entry,
            commands::storage_clear_history,
            commands::storage_clear_all_history,
            commands::storage_delete_history_entry,
            // ── Import / Export commands ───────────────────────────────────────
            commands::export_connections,
            commands::import_connections,
            commands::parse_connection_uri,
            commands::check_export_protected,
            // ── Updater commands ───────────────────────────────────────────────
            commands::check_for_updates,
            commands::install_update,
            // ── Font commands ──────────────────────────────────────────────────
            commands::get_system_fonts,
            // ── License commands ───────────────────────────────────────────────
            commands::license_get_device_id,
            commands::license_check_offline,
            commands::license_verify_and_store,
            commands::license_deactivate,
            commands::license_get_stored,
            commands::license_update_validated,
            commands::license_get_device_name,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

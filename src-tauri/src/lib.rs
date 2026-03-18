pub mod commands;
pub mod db;
pub mod storage;
pub mod types;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("could not resolve app data dir");

            tauri::async_runtime::block_on(storage::AppStorage::init(data_dir))
                .expect("failed to initialise storage");

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // ── DB driver commands ─────────────────────────────────────────────
            commands::connect_database,
            commands::disconnect_database,
            commands::get_databases,
            commands::get_tables,
            commands::execute_query,
            commands::get_table_data,
            commands::list_all_tables,
            commands::get_user_databases,
            commands::get_table_structure,
            // ── App info ──────────────────────────────────────────────────────
            commands::get_app_data_dir,
            // ── Storage commands ───────────────────────────────────────────────
            commands::storage_load_connections,
            commands::storage_save_connection,
            commands::storage_delete_connection,
            commands::storage_load_queries,
            commands::storage_save_query,
            commands::storage_delete_query,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

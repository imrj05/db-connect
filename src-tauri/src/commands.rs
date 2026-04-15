use crate::db::mysql::MySqlDriver;
use crate::db::postgres::PostgresDriver;
use crate::db::registry::REGISTRY;
use crate::db::sqlite::SqliteDriver;
use crate::db::DatabaseDriver;
use crate::license;
use crate::ssh::{SshAuth, SshTunnel};
use crate::storage::AppStorage;
use crate::types::*;
use anyhow::Result;
use std::sync::Arc;
use tauri_plugin_updater::UpdaterExt;

use crate::db::mongodb::MongoDriver;
use crate::db::redis_driver::RedisDriver;

// System databases/schemas to always exclude
const SYSTEM_DATABASES: &[&str] = &[
    // MySQL / MariaDB
    "information_schema",
    "performance_schema",
    "mysql",
    "sys",
    // PostgreSQL
    "postgres",
    "template0",
    "template1",
    // PostgreSQL schemas
    "pg_catalog",
    "pg_toast",
    "pg_temp_1",
    "pg_toast_temp_1",
];

#[tauri::command]
pub async fn connect_database(mut config: ConnectionConfig) -> Result<(), String> {
    // ── SSH tunnel setup ───────────────────────────────────────────────────────
    if config.ssh_enabled.unwrap_or(false) {
        let ssh_host = config.ssh_host.clone().ok_or("SSH host is required")?;
        let ssh_port = config.ssh_port.unwrap_or(22);
        let ssh_user = config.ssh_user.clone().ok_or("SSH user is required")?;

        let auth = if let Some(key_path) = config.ssh_key_path.clone().filter(|p| !p.is_empty()) {
            SshAuth::Key {
                path: key_path,
                passphrase: config.ssh_key_passphrase.clone().filter(|p| !p.is_empty()),
            }
        } else {
            let pw = config.ssh_password.clone().unwrap_or_default();
            SshAuth::Password(pw)
        };

        // The DB host/port to forward to (from the connection config)
        let db_host = config
            .host
            .clone()
            .unwrap_or_else(|| "localhost".to_string());
        let db_port = config.port.unwrap_or(5432);

        let tunnel = SshTunnel::establish(&ssh_host, ssh_port, &ssh_user, auth, db_host, db_port)
            .await
            .map_err(|e| format!("SSH tunnel failed: {e}"))?;

        // Redirect the driver to connect via the local tunnel port
        config.host = Some("127.0.0.1".to_string());
        config.port = Some(tunnel.local_port);

        REGISTRY.tunnels.insert(config.id.clone(), tunnel);
    }

    let driver: Arc<dyn DatabaseDriver> = match config.db_type {
        DatabaseType::Postgresql => Arc::new(PostgresDriver::new()),
        DatabaseType::Mysql => Arc::new(MySqlDriver::new()),
        DatabaseType::Sqlite => Arc::new(SqliteDriver::new()),
        DatabaseType::Mongodb => Arc::new(MongoDriver::new()),
        DatabaseType::Redis => Arc::new(RedisDriver::new()),
    };

    if let Err(e) = driver.connect(&config).await {
        // If the driver connect fails, clean up the tunnel we just opened
        if let Some((_, tunnel)) = REGISTRY.tunnels.remove(&config.id) {
            tunnel.close();
        }
        return Err(e.to_string());
    }

    REGISTRY.connections.insert(config.id.clone(), driver);
    REGISTRY.configs.insert(config.id.clone(), config);

    Ok(())
}

#[tauri::command]
pub async fn disconnect_database(id: String) -> Result<(), String> {
    if let Some((_, driver)) = REGISTRY.connections.remove(&id) {
        driver.disconnect().await.map_err(|e| e.to_string())?;
    }
    // Close SSH tunnel after the driver disconnects
    if let Some((_, tunnel)) = REGISTRY.tunnels.remove(&id) {
        tunnel.close();
    }
    REGISTRY.configs.remove(&id);
    Ok(())
}

#[tauri::command]
pub async fn get_databases(id: String) -> Result<Vec<String>, String> {
    let driver = REGISTRY
        .connections
        .get(&id)
        .ok_or_else(|| "Not connected".to_string())?;

    driver.get_databases().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_tables(
    id: String,
    database: String,
    schema: Option<String>,
) -> Result<Vec<TableInfo>, String> {
    let driver = REGISTRY
        .connections
        .get(&id)
        .ok_or_else(|| "Not connected".to_string())?;

    driver
        .get_tables(&database, schema.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn execute_query(id: String, query: String) -> Result<QueryResult, String> {
    let driver = REGISTRY
        .connections
        .get(&id)
        .ok_or_else(|| "Not connected".to_string())?;

    driver.run_query(&query).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_table_data(
    id: String,
    database: String,
    table: String,
    page: u32,
    page_size: u32,
) -> Result<QueryResult, String> {
    let driver = REGISTRY
        .connections
        .get(&id)
        .ok_or_else(|| "Not connected".to_string())?;

    let mut result = driver
        .get_table_data(&database, &table, page, page_size)
        .await
        .map_err(|e| e.to_string())?;

    // If table is empty, still return column names so the UI can show headers
    if result.rows.is_empty() && result.columns.is_empty() {
        if let Ok(col_infos) = driver.get_columns(&database, &table, None).await {
            result.columns = col_infos.iter().map(|c| c.name.clone()).collect();
        }
    }

    Ok(result)
}

#[tauri::command]
pub async fn get_user_databases(id: String) -> Result<Vec<String>, String> {
    let driver = REGISTRY
        .connections
        .get(&id)
        .ok_or_else(|| "Not connected".to_string())?;

    // Return all databases — let the user pick which one to work with
    driver.get_databases().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_all_tables(
    id: String,
    database: Option<String>,
) -> Result<Vec<TableInfo>, String> {
    let driver = REGISTRY
        .connections
        .get(&id)
        .ok_or_else(|| "Not connected".to_string())?;

    // Determine which databases to query:
    // 1. Explicit override (user selected from dropdown) → only that one
    // 2. Configured database in connection config → only that one
    // 3. Otherwise → all user databases (system DBs filtered out)
    let target_dbs: Vec<String> = if let Some(db) = database {
        vec![db]
    } else {
        let config = REGISTRY.configs.get(&id);
        let configured_db = config.as_ref().and_then(|c| c.database.clone());
        if let Some(db) = configured_db {
            vec![db]
        } else {
            let all_dbs = driver.get_databases().await.map_err(|e| e.to_string())?;
            all_dbs
                .into_iter()
                .filter(|db| !SYSTEM_DATABASES.contains(&db.to_lowercase().as_str()))
                .collect()
        }
    };

    let target_dbs = if target_dbs.is_empty() {
        vec!["default".to_string()]
    } else {
        target_dbs
    };

    let mut all_tables: Vec<TableInfo> = Vec::new();
    for db in &target_dbs {
        match driver.get_tables(db, None).await {
            Ok(tables) => {
                for mut table in tables {
                    if table.schema.is_none() {
                        table.schema = Some(db.clone());
                    }
                    all_tables.push(table);
                }
            }
            Err(e) => eprintln!("[list_all_tables] get_tables({db}) failed: {e}"),
        }
    }

    Ok(all_tables)
}

#[tauri::command]
pub async fn get_table_structure(
    id: String,
    database: String,
    table: String,
    schema: Option<String>,
) -> Result<TableStructure, String> {
    let driver = REGISTRY
        .connections
        .get(&id)
        .ok_or_else(|| "Not connected".to_string())?;

    let columns = driver
        .get_columns(&database, &table, schema.as_deref())
        .await
        .map_err(|e| e.to_string())?;

    let indexes = driver
        .get_indexes(&database, &table, schema.as_deref())
        .await
        .unwrap_or_default();

    Ok(TableStructure { columns, indexes })
}

#[tauri::command]
pub async fn get_schema_graph(
    id: String,
    database: String,
    schema: Option<String>,
) -> Result<SchemaGraph, String> {
    let driver = REGISTRY
        .connections
        .get(&id)
        .ok_or_else(|| "Not connected".to_string())?;

    let config = REGISTRY
        .configs
        .get(&id)
        .ok_or_else(|| "Connection config not found".to_string())?;

    let resolved_schema = match config.db_type {
        DatabaseType::Postgresql | DatabaseType::Sqlite => {
            schema.clone().or_else(|| Some(database.clone()))
        }
        _ => schema.clone(),
    };

    let tables = driver
        .get_tables(&database, resolved_schema.as_deref())
        .await
        .map_err(|e| e.to_string())?;

    let mut graph_tables = Vec::new();
    for table in tables {
        let table_schema = table.schema.clone().or_else(|| resolved_schema.clone());
        let columns = driver
            .get_columns(&database, &table.name, table_schema.as_deref())
            .await
            .map_err(|e| e.to_string())?;

        graph_tables.push(SchemaGraphTable {
            name: table.name,
            schema: table_schema,
            columns,
        });
    }

    let relationships = driver
        .get_foreign_keys(&database, resolved_schema.as_deref())
        .await
        .unwrap_or_default();

    Ok(SchemaGraph {
        tables: graph_tables,
        relationships,
    })
}

/// Reconnect the driver to a different database within the same server.
/// Required for PostgreSQL where you cannot change the database of an existing
/// connection — a new pool must be created. For other drivers this is a no-op
/// reconnect that also updates the active database.
#[tauri::command]
pub async fn switch_database(id: String, database: String) -> Result<(), String> {
    let driver = REGISTRY
        .connections
        .get(&id)
        .ok_or_else(|| "Not connected".to_string())?
        .clone();

    let mut new_config = REGISTRY
        .configs
        .get(&id)
        .ok_or_else(|| "Connection config not found".to_string())?
        .clone();

    new_config.database = Some(database.clone());

    driver
        .connect(&new_config)
        .await
        .map_err(|e| e.to_string())?;

    REGISTRY
        .configs
        .entry(id)
        .and_modify(|c| c.database = Some(database));

    Ok(())
}

#[tauri::command]
pub async fn dump_database(
    id: String,
    database: String,
    schema: Option<String>,
    include_data: bool,
    include_indexes: bool,
    include_foreign_keys: bool,
    create_database: bool,
) -> Result<String, String> {
    let driver = REGISTRY
        .connections
        .get(&id)
        .ok_or_else(|| "Not connected".to_string())?;

    let config = REGISTRY
        .configs
        .get(&id)
        .ok_or_else(|| "Connection config not found".to_string())?;

    match config.db_type {
        DatabaseType::Postgresql | DatabaseType::Mysql | DatabaseType::Sqlite => {
            driver
                .dump_database(
                    &database,
                    schema.as_deref(),
                    include_data,
                    include_indexes,
                    include_foreign_keys,
                    create_database,
                )
                .await
                .map_err(|e| e.to_string())
        }
        _ => Err("Dump not supported for this database type".to_string()),
    }
}

// ── App info commands ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_app_data_dir(app: tauri::AppHandle) -> Result<String, String> {
    use tauri::Manager;
    app.path()
        .app_data_dir()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

// ── Storage commands ───────────────────────────────────────────────────────────

#[tauri::command]
pub async fn storage_load_connections() -> Result<Vec<ConnectionConfig>, String> {
    AppStorage::get()
        .load_connections()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn storage_save_connection(connection: ConnectionConfig) -> Result<(), String> {
    AppStorage::get()
        .save_connection(&connection)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn storage_delete_connection(id: String) -> Result<(), String> {
    AppStorage::get()
        .delete_connection(&id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn storage_load_queries() -> Result<Vec<SavedQuery>, String> {
    AppStorage::get()
        .load_queries()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn storage_save_query(query: SavedQuery) -> Result<(), String> {
    AppStorage::get()
        .save_query(&query)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn storage_delete_query(id: String) -> Result<(), String> {
    AppStorage::get()
        .delete_query(&id)
        .await
        .map_err(|e| e.to_string())
}

// ── Query history commands ──────────────────────────────────────────────────────

#[tauri::command]
pub async fn storage_load_history() -> Result<Vec<crate::types::QueryHistoryEntry>, String> {
    AppStorage::get()
        .load_history()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn storage_save_history_entry(
    entry: crate::types::QueryHistoryEntry,
) -> Result<(), String> {
    AppStorage::get()
        .save_history_entry(&entry)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn storage_clear_history(connection_id: String) -> Result<(), String> {
    AppStorage::get()
        .clear_history_for_connection(&connection_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn storage_clear_all_history() -> Result<(), String> {
    AppStorage::get()
        .clear_all_history()
        .await
        .map_err(|e| e.to_string())
}

// ── Import / Export commands ────────────────────────────────────────────────

#[tauri::command]
pub async fn export_connections(opts: crate::types::ExportOptions) -> Result<String, String> {
    let conns = AppStorage::get()
        .load_connections()
        .await
        .map_err(|e| e.to_string())?;

    match opts.format {
        crate::types::ExportFormat::Json => {
            crate::import_export::export_native_json(&conns, &opts).map_err(|e| e.to_string())
        }
        crate::types::ExportFormat::Uri => Ok(crate::import_export::export_uri_text(
            &conns,
            opts.include_passwords,
        )),
    }
}

#[tauri::command]
pub async fn import_connections(
    content: String,
    opts: crate::types::ImportOptions,
) -> Result<crate::types::ImportResult, String> {
    let existing = AppStorage::get()
        .load_connections()
        .await
        .map_err(|e| e.to_string())?;
    let existing_ids: std::collections::HashSet<String> =
        existing.iter().map(|c| c.id.clone()).collect();

    let result = match opts.format {
        crate::types::ImportFormat::Json => {
            crate::import_export::import_native_json(&content, &opts, &existing_ids)
                .map_err(|e| e.to_string())?
        }
        crate::types::ImportFormat::Dbeaver => {
            crate::import_export::import_dbeaver(&content, &opts, &existing_ids)
                .map_err(|e| e.to_string())?
        }
        crate::types::ImportFormat::Uri => {
            return Err("Use parse_connection_uri for single URIs".to_string());
        }
    };

    for conn in &result.connections {
        AppStorage::get()
            .save_connection(conn)
            .await
            .map_err(|e| e.to_string())?;
    }

    Ok(result)
}

#[tauri::command]
pub async fn parse_connection_uri(uri: String) -> Result<crate::types::ConnectionConfig, String> {
    crate::import_export::parse_uri(&uri).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn check_export_protected(content: String) -> Result<bool, String> {
    let export: crate::types::ConnectionExport =
        serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(export.password_protected)
}

// ── Updater commands ───────────────────────────────────────────────────────────

#[derive(serde::Serialize)]
pub struct UpdateInfo {
    pub available: bool,
    pub version: Option<String>,
    pub current_version: String,
    pub body: Option<String>,
}

#[tauri::command]
pub async fn check_for_updates(app: tauri::AppHandle) -> Result<UpdateInfo, String> {
    let current = app.package_info().version.to_string();
    let updater = app.updater_builder().build().map_err(|e| e.to_string())?;
    match updater.check().await.map_err(|e| e.to_string())? {
        Some(update) => Ok(UpdateInfo {
            available: true,
            version: Some(update.version.clone()),
            current_version: current,
            body: update.body.clone(),
        }),
        None => Ok(UpdateInfo {
            available: false,
            version: None,
            current_version: current,
            body: None,
        }),
    }
}

#[tauri::command]
pub async fn install_update(app: tauri::AppHandle) -> Result<(), String> {
    let updater = app.updater_builder().build().map_err(|e| e.to_string())?;
    let update = updater
        .check()
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "No update available".to_string())?;
    update
        .download_and_install(|_, _| {}, || {})
        .await
        .map_err(|e| e.to_string())?;

    // The updater installs the new bundle, but the app still needs to relaunch
    // into it explicitly.
    app.request_restart();

    Ok(())
}

// ── License commands ───────────────────────────────────────────────────────────

/// Returns the stable device UUID for this installation (generated on first run).
#[tauri::command]
pub async fn license_get_device_id() -> Result<String, String> {
    license::get_or_create_device_id()
        .await
        .map_err(|e| e.to_string())
}

/// Runs the full offline license check and returns the result.
/// Called on every app startup before showing the main UI.
#[tauri::command]
pub async fn license_check_offline() -> license::OfflineCheckResult {
    license::verify_offline().await
}

/// Verifies a signed license payload (received from the activation server)
/// and persists it as the local license state for this device.
#[tauri::command]
pub async fn license_verify_and_store(
    license_payload: license::SignedLicense,
) -> Result<license::OfflineCheckResult, String> {
    license::verify_and_store(license_payload)
        .await
        .map_err(|e| e.to_string())
}

/// Clears the stored license state (deactivates this device).
#[tauri::command]
pub async fn license_deactivate() -> Result<(), String> {
    license::clear_state().await.map_err(|e| e.to_string())
}

/// Returns the currently stored license state, or null if none.
#[tauri::command]
pub async fn license_get_stored() -> Result<Option<license::StoredLicenseState>, String> {
    license::load_state().await.map_err(|e| e.to_string())
}

/// Updates `last_validated_at` after a successful background online sync.
#[tauri::command]
pub async fn license_update_validated() -> Result<(), String> {
    license::update_last_validated()
        .await
        .map_err(|e| e.to_string())
}

/// Returns the human-readable device name for the current machine.
/// On macOS uses the friendly computer name (System Preferences → Sharing).
/// Falls back to OS hostname on other platforms.
#[tauri::command]
pub async fn license_get_device_name() -> String {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        // scutil --get ComputerName returns the friendly name set in System Preferences
        if let Ok(out) = Command::new("scutil").args(["--get", "ComputerName"]).output() {
            let name = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !name.is_empty() {
                return name;
            }
        }
        // Fall back to hostname
        if let Ok(out) = Command::new("hostname").output() {
            let name = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !name.is_empty() {
                return name;
            }
        }
        "My Mac".to_string()
    }
    #[cfg(target_os = "windows")]
    {
        std::env::var("COMPUTERNAME").unwrap_or_else(|_| "My Windows PC".to_string())
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        use std::process::Command;
        if let Ok(out) = Command::new("hostname").output() {
            let name = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !name.is_empty() {
                return name;
            }
        }
        std::env::var("HOSTNAME").unwrap_or_else(|_| "My Device".to_string())
    }
}

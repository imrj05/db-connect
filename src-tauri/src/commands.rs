use crate::storage::AppStorage;
use crate::types::*;
use crate::db::registry::REGISTRY;
use crate::db::postgres::PostgresDriver;
use crate::db::mysql::MySqlDriver;
use crate::db::sqlite::SqliteDriver;
use crate::db::DatabaseDriver;
use crate::ssh::{SshAuth, SshTunnel};
use std::sync::Arc;
use anyhow::Result;

use crate::db::mongodb::MongoDriver;
use crate::db::redis_driver::RedisDriver;

// System databases/schemas to always exclude
const SYSTEM_DATABASES: &[&str] = &[
    // MySQL / MariaDB
    "information_schema", "performance_schema", "mysql", "sys",
    // PostgreSQL
    "postgres", "template0", "template1",
    // PostgreSQL schemas
    "pg_catalog", "pg_toast", "pg_temp_1", "pg_toast_temp_1",
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
        let db_host = config.host.clone().unwrap_or_else(|| "localhost".to_string());
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
    let driver = REGISTRY.connections.get(&id)
        .ok_or_else(|| "Not connected".to_string())?;

    driver.get_databases().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_tables(id: String, database: String, schema: Option<String>) -> Result<Vec<TableInfo>, String> {
    let driver = REGISTRY.connections.get(&id)
        .ok_or_else(|| "Not connected".to_string())?;

    driver.get_tables(&database, schema.as_deref()).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn execute_query(id: String, query: String) -> Result<QueryResult, String> {
    let driver = REGISTRY.connections.get(&id)
        .ok_or_else(|| "Not connected".to_string())?;

    driver.run_query(&query).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_table_data(id: String, database: String, table: String, page: u32, page_size: u32) -> Result<QueryResult, String> {
    let driver = REGISTRY.connections.get(&id)
        .ok_or_else(|| "Not connected".to_string())?;

    let mut result = driver.get_table_data(&database, &table, page, page_size)
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
    let driver = REGISTRY.connections.get(&id)
        .ok_or_else(|| "Not connected".to_string())?;

    // Return all databases — let the user pick which one to work with
    driver.get_databases().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_all_tables(id: String, database: Option<String>) -> Result<Vec<TableInfo>, String> {
    let driver = REGISTRY.connections.get(&id)
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
            all_dbs.into_iter()
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
pub async fn get_table_structure(id: String, database: String, table: String, schema: Option<String>) -> Result<TableStructure, String> {
    let driver = REGISTRY.connections.get(&id)
        .ok_or_else(|| "Not connected".to_string())?;

    let columns = driver.get_columns(&database, &table, schema.as_deref())
        .await
        .map_err(|e| e.to_string())?;

    let indexes = driver.get_indexes(&database, &table, schema.as_deref())
        .await
        .unwrap_or_default();

    Ok(TableStructure { columns, indexes })
}

/// Reconnect the driver to a different database within the same server.
/// Required for PostgreSQL where you cannot change the database of an existing
/// connection — a new pool must be created. For other drivers this is a no-op
/// reconnect that also updates the active database.
#[tauri::command]
pub async fn switch_database(id: String, database: String) -> Result<(), String> {
    let driver = REGISTRY.connections.get(&id)
        .ok_or_else(|| "Not connected".to_string())?
        .clone();

    let mut new_config = REGISTRY.configs.get(&id)
        .ok_or_else(|| "Connection config not found".to_string())?
        .clone();

    new_config.database = Some(database.clone());

    driver.connect(&new_config).await.map_err(|e| e.to_string())?;

    REGISTRY.configs.entry(id).and_modify(|c| c.database = Some(database));

    Ok(())
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
pub async fn storage_save_history_entry(entry: crate::types::QueryHistoryEntry) -> Result<(), String> {
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
        crate::types::ExportFormat::Uri => {
            Ok(crate::import_export::export_uri_text(&conns, opts.include_passwords))
        }
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

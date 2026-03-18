use crate::storage::AppStorage;
use crate::types::*;
use crate::db::registry::REGISTRY;
use crate::db::postgres::PostgresDriver;
use crate::db::mysql::MySqlDriver;
use crate::db::sqlite::SqliteDriver;
use crate::db::DatabaseDriver;
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
pub async fn connect_database(config: ConnectionConfig) -> Result<(), String> {
    let driver: Arc<dyn DatabaseDriver> = match config.db_type {
        DatabaseType::Postgresql => Arc::new(PostgresDriver::new()),
        DatabaseType::Mysql => Arc::new(MySqlDriver::new()),
        DatabaseType::Sqlite => Arc::new(SqliteDriver::new()),
        DatabaseType::Mongodb => Arc::new(MongoDriver::new()),
        DatabaseType::Redis => Arc::new(RedisDriver::new()),
    };

    driver.connect(&config).await.map_err(|e| e.to_string())?;

    REGISTRY.connections.insert(config.id.clone(), driver);
    REGISTRY.configs.insert(config.id.clone(), config);

    Ok(())
}

#[tauri::command]
pub async fn disconnect_database(id: String) -> Result<(), String> {
    if let Some((_, driver)) = REGISTRY.connections.remove(&id) {
        driver.disconnect().await.map_err(|e| e.to_string())?;
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
        if let Ok(tables) = driver.get_tables(db, None).await {
            for mut table in tables {
                if table.schema.is_none() {
                    table.schema = Some(db.clone());
                }
                all_tables.push(table);
            }
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

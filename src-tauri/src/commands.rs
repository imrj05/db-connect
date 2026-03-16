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
    
    Ok(())
}

#[tauri::command]
pub async fn disconnect_database(id: String) -> Result<(), String> {
    if let Some((_, driver)) = REGISTRY.connections.remove(&id) {
        driver.disconnect().await.map_err(|e| e.to_string())?;
    }
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
pub async fn get_table_data(id: String, table: String, page: u32, page_size: u32) -> Result<QueryResult, String> {
    let driver = REGISTRY.connections.get(&id)
        .ok_or_else(|| "Not connected".to_string())?;
    
    driver.get_table_data(&table, page, page_size).await.map_err(|e| e.to_string())
}

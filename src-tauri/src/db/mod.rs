pub mod registry;
pub mod postgres;
pub mod mysql;
pub mod sqlite;
pub mod mongodb;
pub mod redis_driver;
use async_trait::async_trait;
use crate::types::*;
use anyhow::Result;

#[async_trait]
pub trait DatabaseDriver: Send + Sync {
    async fn connect(&self, config: &ConnectionConfig) -> Result<()>;
    async fn disconnect(&self) -> Result<()>;
    async fn get_databases(&self) -> Result<Vec<String>>;
    async fn get_schemas(&self, database: &str) -> Result<Vec<String>>;
    async fn get_tables(&self, database: &str, schema: Option<&str>) -> Result<Vec<TableInfo>>;
    async fn get_columns(&self, database: &str, table: &str, schema: Option<&str>) -> Result<Vec<ColumnInfo>>;
    async fn run_query(&self, query: &str) -> Result<QueryResult>;
    async fn get_table_data(&self, table: &str, page: u32, page_size: u32) -> Result<QueryResult>;
}

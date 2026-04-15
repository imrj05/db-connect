pub mod mongodb;
pub mod mysql;
pub mod postgres;
pub mod redis_driver;
pub mod registry;
pub mod sqlite;
use crate::types::*;
use anyhow::Result;
use async_trait::async_trait;

#[async_trait]
pub trait DatabaseDriver: Send + Sync {
    async fn connect(&self, config: &ConnectionConfig) -> Result<()>;
    async fn disconnect(&self) -> Result<()>;
    async fn get_databases(&self) -> Result<Vec<String>>;
    async fn get_schemas(&self, database: &str) -> Result<Vec<String>>;
    async fn get_tables(&self, database: &str, schema: Option<&str>) -> Result<Vec<TableInfo>>;
    async fn get_columns(
        &self,
        database: &str,
        table: &str,
        schema: Option<&str>,
    ) -> Result<Vec<ColumnInfo>>;
    async fn get_indexes(
        &self,
        _database: &str,
        _table: &str,
        _schema: Option<&str>,
    ) -> Result<Vec<IndexInfo>> {
        Ok(vec![])
    }
    async fn get_foreign_keys(
        &self,
        _database: &str,
        _schema: Option<&str>,
    ) -> Result<Vec<ForeignKeyRelation>> {
        Ok(vec![])
    }
    async fn run_query(&self, query: &str) -> Result<QueryResult>;
    async fn get_table_data(
        &self,
        database: &str,
        table: &str,
        page: u32,
        page_size: u32,
    ) -> Result<QueryResult>;

    async fn dump_database(
        &self,
        _database: &str,
        _schema: Option<&str>,
        _include_data: bool,
        _include_indexes: bool,
        _include_foreign_keys: bool,
        _create_database: bool,
    ) -> Result<String> {
        Err(anyhow::anyhow!("Dump not supported for this database type"))
    }
}

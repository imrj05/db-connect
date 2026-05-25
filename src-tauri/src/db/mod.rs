pub mod mongodb;
pub mod mysql;
pub mod postgres;
pub mod redis_driver;
pub mod registry;
pub mod sqlite;
use crate::types::*;
use anyhow::{anyhow, Result};
use async_trait::async_trait;

// ── SQL Identifier Validation ─────────────────────────────────────────────────

/// Characters that are NEVER safe in an unquoted SQL identifier.
/// Even when identifiers are quoted, these characters can be used for injection
/// if the identifier content is not properly escaped by the database driver.
const UNSAFE_IDENTIFIER_CHARS: &[char] = &['"', '\'', '`', '\0', ';'];

/// Validate that a SQL identifier (table name, schema name, column name) does not
/// contain characters that could be exploited for SQL injection.
///
/// This does NOT enforce a strict character set — unicode and most special chars
/// are allowed — but it rejects the most dangerous characters:
///   - quote characters (", ', `) — used to break out of identifiers
///   - null byte — can truncate strings
///   - semicolon — statement terminator
///
/// Returns `Ok(())` if safe, or an error describing the problem.
pub fn validate_sql_identifier(identifier: &str, what: &str) -> Result<()> {
    for ch in UNSAFE_IDENTIFIER_CHARS {
        if identifier.contains(*ch) {
            return Err(anyhow!(
                "{what} contains unsafe character '{}' (U+{:04X}): \"{identifier}\"",
                ch,
                *ch as u32
            ));
        }
    }
    Ok(())
}

/// Validate all identifier components used in a table data query.
/// This is the primary injection protection for `get_table_data`.
pub fn validate_table_query_identifiers(database: &str, table: &str, schema: Option<&str>) -> Result<()> {
    validate_sql_identifier(database, "database name")?;
    validate_sql_identifier(table, "table name")?;
    if let Some(s) = schema {
        validate_sql_identifier(s, "schema name")?;
    }
    Ok(())
}

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

    async fn ping(&self) -> Result<()> {
        self.run_query("SELECT 1").await.map(|_| ())
    }

    async fn create_database(&self, _name: &str) -> Result<()> {
        Err(anyhow::anyhow!(
            "Create database not supported for this database type"
        ))
    }

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

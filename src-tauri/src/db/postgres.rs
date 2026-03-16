use async_trait::async_trait;
use sqlx::{postgres::PgPoolOptions, Pool, Postgres, Row, Column};
use crate::types::*;
use crate::db::DatabaseDriver;
use anyhow::{Result, anyhow};
use std::time::Instant;

pub struct PostgresDriver {
    pub pool: tokio::sync::RwLock<Option<Pool<Postgres>>>,
}

impl PostgresDriver {
    pub fn new() -> Self {
        Self {
            pool: tokio::sync::RwLock::new(Option::None),
        }
    }
}

#[async_trait]
impl DatabaseDriver for PostgresDriver {
    async fn connect(&self, config: &ConnectionConfig) -> Result<()> {
        let url = if let Some(uri) = &config.uri {
            uri.clone()
        } else {
            format!(
                "postgres://{}:{}@{}:{}/{}",
                config.user.as_deref().unwrap_or("postgres"),
                config.password.as_deref().unwrap_or(""),
                config.host.as_deref().unwrap_or("localhost"),
                config.port.unwrap_or(5432),
                config.database.as_deref().unwrap_or("postgres")
            )
        };

        let pool = PgPoolOptions::new()
            .max_connections(5)
            .connect(&url)
            .await?;

        let mut pool_lock = self.pool.write().await;
        *pool_lock = Some(pool);
        Ok(())
    }

    async fn disconnect(&self) -> Result<()> {
        let mut pool_lock = self.pool.write().await;
        if let Some(pool) = pool_lock.take() {
            pool.close().await;
        }
        Ok(())
    }

    async fn get_databases(&self) -> Result<Vec<String>> {
        let pool_lock = self.pool.read().await;
        let pool = pool_lock.as_ref().ok_or_else(|| anyhow!("Not connected"))?;
        
        let rows = sqlx::query("SELECT datname FROM pg_database WHERE datistemplate = false")
            .fetch_all(pool)
            .await?;

        Ok(rows.iter().map(|r| r.get::<String, _>(0)).collect())
    }

    async fn get_schemas(&self, _database: &str) -> Result<Vec<String>> {
        let pool_lock = self.pool.read().await;
        let pool = pool_lock.as_ref().ok_or_else(|| anyhow!("Not connected"))?;
        
        let rows = sqlx::query("SELECT schema_name FROM information_schema.schemata")
            .fetch_all(pool)
            .await?;

        Ok(rows.iter().map(|r| r.get::<String, _>(0)).collect())
    }

    async fn get_tables(&self, _database: &str, schema: Option<&str>) -> Result<Vec<TableInfo>> {
        let pool_lock = self.pool.read().await;
        let pool = pool_lock.as_ref().ok_or_else(|| anyhow!("Not connected"))?;
        
        let schema_name = schema.unwrap_or("public");
        let rows = sqlx::query("SELECT table_name FROM information_schema.tables WHERE table_schema = $1")
            .bind(schema_name)
            .fetch_all(pool)
            .await?;

        Ok(rows.iter().map(|r| TableInfo {
            name: r.get::<String, _>(0),
            schema: Some(schema_name.to_string()),
        }).collect())
    }

    async fn get_columns(&self, _database: &str, table: &str, schema: Option<&str>) -> Result<Vec<ColumnInfo>> {
        let pool_lock = self.pool.read().await;
        let pool = pool_lock.as_ref().ok_or_else(|| anyhow!("Not connected"))?;
        
        let schema_name = schema.unwrap_or("public");
        let rows = sqlx::query(
            "SELECT column_name, data_type, is_nullable, column_default 
             FROM information_schema.columns 
             WHERE table_name = $1 AND table_schema = $2"
        )
        .bind(table)
        .bind(schema_name)
        .fetch_all(pool)
        .await?;

        Ok(rows.iter().map(|r| ColumnInfo {
            name: r.get::<String, _>(0),
            data_type: r.get::<String, _>(1),
            nullable: r.get::<String, _>(2) == "YES",
            is_primary: false, // Implementation needs more logic for PK
        }).collect())
    }

    async fn run_query(&self, query: &str) -> Result<QueryResult> {
        let pool_lock = self.pool.read().await;
        let pool = pool_lock.as_ref().ok_or_else(|| anyhow!("Not connected"))?;
        
        let start = Instant::now();
        let rows = sqlx::query(query)
            .fetch_all(pool)
            .await?;
        let duration = start.elapsed().as_millis() as u64;

        if rows.is_empty() {
             return Ok(QueryResult {
                columns: vec![],
                rows: vec![],
                execution_time_ms: duration,
            });
        }

        let columns = rows[0].columns().iter().map(|c| c.name().to_string()).collect::<Vec<_>>();
        let mut result_rows = Vec::new();

        for row in rows {
            let mut obj = serde_json::Map::<String, serde_json::Value>::new();
            for (i, col_name) in columns.iter().enumerate() {
                 let val: serde_json::Value = if let Ok(s) = row.try_get::<String, _>(i) {
                    serde_json::Value::String(s)
                } else if let Ok(n) = row.try_get::<i64, _>(i) {
                    serde_json::Value::Number(n.into())
                } else if let Ok(b) = row.try_get::<bool, _>(i) {
                    serde_json::Value::Bool(b)
                } else {
                    serde_json::Value::Null
                };
                obj.insert(col_name.clone(), val);
            }
            result_rows.push(serde_json::Value::Object(obj));
        }

        Ok(QueryResult {
            columns,
            rows: result_rows,
            execution_time_ms: duration,
        })
    }

    async fn get_table_data(&self, table: &str, page: u32, page_size: u32) -> Result<QueryResult> {
        let query = format!("SELECT * FROM {} LIMIT {} OFFSET {}", table, page_size, page * page_size);
        self.run_query(&query).await
    }
}

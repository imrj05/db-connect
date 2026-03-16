use async_trait::async_trait;
use sqlx::{mysql::MySqlPoolOptions, Pool, MySql, Row, Column, Executor};
use crate::types::*;
use crate::db::DatabaseDriver;
use anyhow::{Result, anyhow};
use std::time::Instant;

pub struct MySqlDriver {
    pub pool: tokio::sync::RwLock<Option<Pool<MySql>>>,
}

impl MySqlDriver {
    pub fn new() -> Self {
        Self {
            pool: tokio::sync::RwLock::new(Option::None),
        }
    }
}

#[async_trait]
impl DatabaseDriver for MySqlDriver {
    async fn connect(&self, config: &ConnectionConfig) -> Result<()> {
        let database = config.database.as_deref().unwrap_or("mysql");
        let url = if let Some(uri) = &config.uri {
            uri.clone()
        } else {
            format!(
                "mysql://{}:{}@{}:{}/{}",
                config.user.as_deref().unwrap_or("root"),
                config.password.as_deref().unwrap_or(""),
                config.host.as_deref().unwrap_or("localhost"),
                config.port.unwrap_or(3306),
                database
            )
        };

        let pool = MySqlPoolOptions::new()
            .max_connections(5)
            .connect(&url)
            .await?;

        // Ensure we are using the correct database after connection
        // Using execute on pool directly for non-prepared statements
        pool.execute(format!("USE `{}`", database).as_str()).await?;

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

        let rows = pool.fetch_all("SHOW DATABASES").await?;

        Ok(rows.iter().map(|r| r.get::<String, _>(0)).collect())
    }

    async fn get_schemas(&self, _database: &str) -> Result<Vec<String>> {
        Ok(vec!["default".to_string()])
    }

    async fn get_tables(&self, database: &str, _schema: Option<&str>) -> Result<Vec<TableInfo>> {
        let pool_lock = self.pool.read().await;
        let pool = pool_lock.as_ref().ok_or_else(|| anyhow!("Not connected"))?;

        // Switch to the target database
        pool.execute(format!("USE `{}`", database).as_str()).await?;

        let rows = pool.fetch_all(format!("SHOW TABLES FROM `{}`", database).as_str()).await?;

        Ok(rows.iter().map(|r| TableInfo {
            name: r.get::<String, _>(0),
            schema: None,
            columns: None,
        }).collect())
    }

    async fn get_columns(&self, database: &str, table: &str, _schema: Option<&str>) -> Result<Vec<ColumnInfo>> {
        let pool_lock = self.pool.read().await;
        let pool = pool_lock.as_ref().ok_or_else(|| anyhow!("Not connected"))?;

        pool.execute(format!("USE `{}`", database).as_str()).await?;

        let rows = pool.fetch_all(format!("SHOW COLUMNS FROM `{}`.`{}`", database, table).as_str()).await?;

        Ok(rows.iter().map(|r| ColumnInfo {
            name: r.get::<String, _>(0),
            data_type: r.get::<String, _>(1),
            nullable: r.get::<String, _>(2) == "YES",
            is_primary: r.get::<String, _>(3) == "PRI",
        }).collect())
    }

    async fn run_query(&self, query: &str) -> Result<QueryResult> {
        let pool_lock = self.pool.read().await;
        let pool = pool_lock.as_ref().ok_or_else(|| anyhow!("Not connected"))?;

        let start = Instant::now();
        // Use a better way to fetch rows that handles type conversion more robustly
        use sqlx::Column;
        use sqlx::Row;

        let rows = pool.fetch_all(query).await?;
        let duration = start.elapsed().as_millis() as u64;

        if rows.is_empty() {
            let columns = if let Ok(metadata) = pool.fetch_optional(query).await {
                // This is a bit of a hack to get column names for empty results if possible
                // but fetch_all already returns the rows which contain metadata.
                // If rows is empty, we might not have a clean way without a separate query
                vec![]
            } else {
                vec![]
            };

            return Ok(QueryResult {
                columns,
                rows: vec![],
                execution_time_ms: duration,
            });
        }

        let columns = rows[0].columns().iter().map(|c| c.name().to_string()).collect::<Vec<_>>();
        let mut result_rows = Vec::new();

        for row in &rows {
            let mut obj = serde_json::Map::<String, serde_json::Value>::new();
            for (i, col_name) in columns.iter().enumerate() {
                // Determine value with more precise type handling for MySQL
                let val: serde_json::Value = if let Ok(s) = row.try_get::<String, _>(i) {
                    serde_json::Value::String(s)
                } else if let Ok(n) = row.try_get::<i64, _>(i) {
                    serde_json::Value::Number(n.into())
                } else if let Ok(u) = row.try_get::<u64, _>(i) {
                    serde_json::Value::Number(u.into())
                } else if let Ok(n) = row.try_get::<i32, _>(i) {
                    serde_json::Value::Number(n.into())
                } else if let Ok(u) = row.try_get::<u32, _>(i) {
                    serde_json::Value::Number(u.into())
                } else if let Ok(n) = row.try_get::<i16, _>(i) {
                    serde_json::Value::Number(n.into())
                } else if let Ok(u) = row.try_get::<u16, _>(i) {
                    serde_json::Value::Number(u.into())
                } else if let Ok(n) = row.try_get::<i8, _>(i) {
                    serde_json::Value::Number(n.into())
                } else if let Ok(u) = row.try_get::<u8, _>(i) {
                    serde_json::Value::Number(u.into())
                } else if let Ok(f) = row.try_get::<f64, _>(i) {
                    serde_json::Value::Number(serde_json::Number::from_f64(f).unwrap_or(0.into()))
                } else if let Ok(f) = row.try_get::<f32, _>(i) {
                    serde_json::Value::Number(serde_json::Number::from_f64(f as f64).unwrap_or(0.into()))
                } else if let Ok(b) = row.try_get::<bool, _>(i) {
                    serde_json::Value::Bool(b)
                } else if let Ok(dt) = row.try_get::<sqlx::types::chrono::NaiveDateTime, _>(i) {
                    serde_json::Value::String(dt.to_string())
                } else if let Ok(dt) = row.try_get::<sqlx::types::chrono::DateTime<sqlx::types::chrono::Utc>, _>(i) {
                    serde_json::Value::String(dt.to_string())
                } else {
                    // Try as bytes if all else fails
                    if let Ok(bytes) = row.try_get::<Vec<u8>, _>(i) {
                        String::from_utf8(bytes)
                            .map(serde_json::Value::String)
                            .unwrap_or_else(|_| serde_json::Value::Null)
                    } else {
                        serde_json::Value::Null
                    }
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

    async fn get_table_data(&self, database: &str, table: &str, page: u32, page_size: u32) -> Result<QueryResult> {
        let pool_lock = self.pool.read().await;
        if let Some(pool) = pool_lock.as_ref() {
            // Re-verify the database connection session
            if let Err(e) = pool.execute(format!("USE `{}`", database).as_str()).await {
                println!("Warning: Failed to switch to database {}: {}", database, e);
            }
        }
        let query = format!("SELECT * FROM `{}`.`{}` LIMIT {} OFFSET {}", database, table, page_size, page * page_size);
        self.run_query(&query).await
    }
}

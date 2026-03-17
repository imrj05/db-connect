use async_trait::async_trait;
use sqlx::{sqlite::SqlitePoolOptions, Pool, Sqlite, Row, Column};
use crate::types::*;
use crate::db::DatabaseDriver;
use anyhow::{Result, anyhow};
use std::time::Instant;

pub struct SqliteDriver {
    pub pool: tokio::sync::RwLock<Option<Pool<Sqlite>>>,
}

impl SqliteDriver {
    pub fn new() -> Self {
        Self {
            pool: tokio::sync::RwLock::new(None),
        }
    }
}

#[async_trait]
impl DatabaseDriver for SqliteDriver {
    async fn connect(&self, config: &ConnectionConfig) -> Result<()> {
        let path = config.database.as_deref().ok_or_else(|| anyhow!("Database path required for SQLite"))?;
        let url = format!("sqlite:{}", path);

        let pool = SqlitePoolOptions::new()
            .max_connections(1)
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
        Ok(vec!["main".to_string()])
    }

    async fn get_schemas(&self, _database: &str) -> Result<Vec<String>> {
        Ok(vec!["main".to_string()])
    }

    async fn get_tables(&self, _database: &str, _schema: Option<&str>) -> Result<Vec<TableInfo>> {
        let pool_lock = self.pool.read().await;
        let pool = pool_lock.as_ref().ok_or_else(|| anyhow!("Not connected"))?;

        let rows = sqlx::query("SELECT name FROM sqlite_master WHERE type='table'")
            .fetch_all(pool)
            .await?;

        Ok(rows.iter().map(|r| TableInfo {
            name: r.get::<String, _>(0),
            schema: Some("main".to_string()),
            columns: None,
        }).collect())
    }

    async fn get_columns(&self, _database: &str, table: &str, _schema: Option<&str>) -> Result<Vec<ColumnInfo>> {
        let pool_lock = self.pool.read().await;
        let pool = pool_lock.as_ref().ok_or_else(|| anyhow!("Not connected"))?;

        // PRAGMA table_info: cid(0), name(1), type(2), notnull(3), dflt_value(4), pk(5)
        let rows = sqlx::query(&format!("PRAGMA table_info(\"{}\")", table))
            .fetch_all(pool)
            .await?;

        Ok(rows.iter().map(|r| ColumnInfo {
            name: r.get(1),
            data_type: r.get(2),
            nullable: r.get::<i32, _>(3) == 0,
            default_value: r.try_get::<Option<String>, _>(4).unwrap_or(None),
            is_primary: r.get::<i32, _>(5) == 1,
            is_unique: false, // determined via indexes
            extra: None,
        }).collect())
    }

    async fn get_indexes(&self, _database: &str, table: &str, _schema: Option<&str>) -> Result<Vec<IndexInfo>> {
        let pool_lock = self.pool.read().await;
        let pool = pool_lock.as_ref().ok_or_else(|| anyhow!("Not connected"))?;

        // PRAGMA index_list: seq(0), name(1), unique(2), origin(3), partial(4)
        let index_rows = sqlx::query(&format!("PRAGMA index_list(\"{}\")", table))
            .fetch_all(pool)
            .await?;

        let mut indexes = Vec::new();
        for irow in &index_rows {
            let index_name: String = irow.get(1);
            let unique: i32 = irow.get(2);

            // PRAGMA index_info: seqno(0), cid(1), name(2)
            let col_rows = sqlx::query(&format!("PRAGMA index_info(\"{}\")", index_name))
                .fetch_all(pool)
                .await
                .unwrap_or_default();

            let mut cols: Vec<(i32, String)> = col_rows.iter().map(|r| {
                (r.get::<i32, _>(0), r.get::<String, _>(2))
            }).collect();
            cols.sort_by_key(|(seq, _)| *seq);

            indexes.push(IndexInfo {
                name: index_name,
                columns: cols.into_iter().map(|(_, c)| c).collect(),
                unique: unique == 1,
                index_type: Some("BTREE".to_string()),
            });
        }

        Ok(indexes)
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
                } else if let Ok(f) = row.try_get::<f64, _>(i) {
                    serde_json::Value::Number(serde_json::Number::from_f64(f).unwrap_or(serde_json::Number::from(0)))
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

    async fn get_table_data(&self, _database: &str, table: &str, page: u32, page_size: u32) -> Result<QueryResult> {
        let query = format!("SELECT * FROM `{}` LIMIT {} OFFSET {}", table, page_size, page * page_size);
        self.run_query(&query).await
    }
}

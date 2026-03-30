use async_trait::async_trait;
use sqlx::{postgres::{PgConnectOptions, PgPoolOptions, PgSslMode}, Pool, Postgres, Row, Column};
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
        let options: PgConnectOptions = if let Some(uri) = &config.uri {
            uri.parse()?
        } else {
            PgConnectOptions::new()
                .host(config.host.as_deref().unwrap_or("localhost"))
                .port(config.port.unwrap_or(5432))
                .username(config.user.as_deref().unwrap_or("postgres"))
                .password(config.password.as_deref().unwrap_or(""))
                .database(config.database.as_deref().unwrap_or("postgres"))
        };

        let ssl_mode = if config.ssl.unwrap_or(false) {
            PgSslMode::Require
        } else {
            PgSslMode::Prefer
        };

        let pool = PgPoolOptions::new()
            .max_connections(5)
            .connect_with(options.ssl_mode(ssl_mode))
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
            columns: None,
        }).collect())
    }

    async fn get_columns(&self, _database: &str, table: &str, schema: Option<&str>) -> Result<Vec<ColumnInfo>> {
        let pool_lock = self.pool.read().await;
        let pool = pool_lock.as_ref().ok_or_else(|| anyhow!("Not connected"))?;

        let schema_name = schema.unwrap_or("public");
        let rows = sqlx::query(
            "SELECT
                col.column_name,
                col.data_type,
                col.is_nullable = 'YES' AS nullable,
                col.column_default,
                COALESCE(bool_or(tc.constraint_type = 'PRIMARY KEY'), false) AS is_primary,
                COALESCE(bool_or(tc.constraint_type = 'UNIQUE'), false) AS is_unique
             FROM information_schema.columns col
             LEFT JOIN information_schema.key_column_usage kcu
                 ON kcu.column_name = col.column_name
                 AND kcu.table_name = col.table_name
                 AND kcu.table_schema = col.table_schema
             LEFT JOIN information_schema.table_constraints tc
                 ON tc.constraint_name = kcu.constraint_name
                 AND tc.table_schema = kcu.table_schema
             WHERE col.table_name = $1 AND col.table_schema = $2
             GROUP BY col.column_name, col.data_type, col.is_nullable, col.column_default, col.ordinal_position
             ORDER BY col.ordinal_position"
        )
        .bind(table)
        .bind(schema_name)
        .fetch_all(pool)
        .await?;

        Ok(rows.iter().map(|r| ColumnInfo {
            name: r.get(0),
            data_type: r.get(1),
            nullable: r.get(2),
            default_value: r.try_get::<Option<String>, _>(3).unwrap_or(None),
            is_primary: r.get(4),
            is_unique: r.get(5),
            extra: None,
        }).collect())
    }

    async fn get_indexes(&self, _database: &str, table: &str, schema: Option<&str>) -> Result<Vec<IndexInfo>> {
        let pool_lock = self.pool.read().await;
        let pool = pool_lock.as_ref().ok_or_else(|| anyhow!("Not connected"))?;

        let schema_name = schema.unwrap_or("public");
        let rows = sqlx::query(
            "SELECT
                i.relname AS index_name,
                ix.indisunique AS is_unique,
                am.amname AS index_type,
                array_agg(a.attname ORDER BY k.ord) AS columns
             FROM pg_index ix
             JOIN pg_class t ON t.oid = ix.indrelid
             JOIN pg_class i ON i.oid = ix.indexrelid
             JOIN pg_am am ON am.oid = i.relam
             JOIN pg_namespace n ON n.oid = t.relnamespace
             JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS k(attnum, ord) ON true
             JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum AND a.attnum > 0
             WHERE t.relname = $1 AND n.nspname = $2
             GROUP BY i.relname, ix.indisunique, am.amname
             ORDER BY i.relname"
        )
        .bind(table)
        .bind(schema_name)
        .fetch_all(pool)
        .await?;

        Ok(rows.iter().map(|r| {
            let cols: Vec<String> = r.try_get::<Vec<String>, _>(3).unwrap_or_default();
            IndexInfo {
                name: r.get(0),
                unique: r.get(1),
                index_type: r.try_get::<String, _>(2).ok(),
                columns: cols,
            }
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

    async fn get_table_data(&self, database: &str, table: &str, page: u32, page_size: u32) -> Result<QueryResult> {
        let query = format!("SELECT * FROM \"{}\".\"{}\" LIMIT {} OFFSET {}", database, table, page_size, page * page_size);
        self.run_query(&query).await
    }
}

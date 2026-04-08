use crate::db::DatabaseDriver;
use crate::types::*;
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use sqlx::{
    mysql::{MySqlConnectOptions, MySqlPoolOptions, MySqlSslMode},
    Executor, MySql, Pool, Row,
};
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

        let options: MySqlConnectOptions = if let Some(uri) = &config.uri {
            uri.parse()?
        } else {
            MySqlConnectOptions::new()
                .host(config.host.as_deref().unwrap_or("localhost"))
                .port(config.port.unwrap_or(3306))
                .username(config.user.as_deref().unwrap_or("root"))
                .password(config.password.as_deref().unwrap_or(""))
                .database(database)
        };

        let ssl_mode = if config.ssl.unwrap_or(false) {
            MySqlSslMode::Required
        } else {
            MySqlSslMode::Disabled
        };

        let pool = MySqlPoolOptions::new()
            .max_connections(5)
            .connect_with(options.ssl_mode(ssl_mode))
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

        let rows = pool
            .fetch_all(format!("SHOW TABLES FROM `{}`", database).as_str())
            .await?;

        Ok(rows
            .iter()
            .map(|r| TableInfo {
                name: r.get::<String, _>(0),
                schema: None,
                columns: None,
            })
            .collect())
    }

    async fn get_columns(
        &self,
        database: &str,
        table: &str,
        _schema: Option<&str>,
    ) -> Result<Vec<ColumnInfo>> {
        let pool_lock = self.pool.read().await;
        let pool = pool_lock.as_ref().ok_or_else(|| anyhow!("Not connected"))?;

        pool.execute(format!("USE `{}`", database).as_str()).await?;

        let rows = pool
            .fetch_all(format!("SHOW FULL COLUMNS FROM `{}`.`{}`", database, table).as_str())
            .await?;

        // SHOW FULL COLUMNS: Field, Type, Collation, Null, Key, Default, Extra, ...
        Ok(rows
            .iter()
            .map(|r| {
                let key: String = r.try_get::<String, _>(4).unwrap_or_default();
                let extra: String = r.try_get::<String, _>(6).unwrap_or_default();
                ColumnInfo {
                    name: r.get(0),
                    data_type: r.get(1),
                    nullable: r.try_get::<String, _>(3).unwrap_or_default() == "YES",
                    is_primary: key == "PRI",
                    is_unique: key == "UNI",
                    default_value: r.try_get::<Option<String>, _>(5).unwrap_or(None),
                    extra: if extra.is_empty() { None } else { Some(extra) },
                }
            })
            .collect())
    }

    async fn get_indexes(
        &self,
        database: &str,
        table: &str,
        _schema: Option<&str>,
    ) -> Result<Vec<IndexInfo>> {
        let pool_lock = self.pool.read().await;
        let pool = pool_lock.as_ref().ok_or_else(|| anyhow!("Not connected"))?;

        pool.execute(format!("USE `{}`", database).as_str()).await?;

        let rows = pool
            .fetch_all(format!("SHOW INDEX FROM `{}`.`{}`", database, table).as_str())
            .await?;

        // SHOW INDEX: Table(0), Non_unique(1), Key_name(2), Seq_in_index(3), Column_name(4), ..., Index_type(10)
        use std::collections::BTreeMap;
        let mut index_map: BTreeMap<String, (bool, Vec<(u32, String)>, String)> = BTreeMap::new();

        for row in &rows {
            let non_unique: i8 = row.try_get::<i8, _>(1).unwrap_or(1);
            let key_name: String = row.try_get(2).unwrap_or_default();
            let seq: u32 = row.try_get::<u32, _>(3).unwrap_or(0);
            let col_name: String = row.try_get(4).unwrap_or_default();
            let index_type: String = row.try_get(10).unwrap_or_else(|_| "BTREE".to_string());

            let entry = index_map
                .entry(key_name)
                .or_insert((non_unique == 0, vec![], index_type));
            entry.1.push((seq, col_name));
        }

        Ok(index_map
            .into_iter()
            .map(|(name, (unique, mut cols, index_type))| {
                cols.sort_by_key(|(seq, _)| *seq);
                IndexInfo {
                    name,
                    columns: cols.into_iter().map(|(_, c)| c).collect(),
                    unique,
                    index_type: Some(index_type),
                }
            })
            .collect())
    }

    async fn get_foreign_keys(
        &self,
        database: &str,
        _schema: Option<&str>,
    ) -> Result<Vec<ForeignKeyRelation>> {
        let pool_lock = self.pool.read().await;
        let pool = pool_lock.as_ref().ok_or_else(|| anyhow!("Not connected"))?;

        pool.execute(format!("USE `{}`", database).as_str()).await?;

        let rows = pool
            .fetch_all(
                format!(
                    "SELECT
                    CONSTRAINT_NAME,
                    TABLE_SCHEMA,
                    TABLE_NAME,
                    COLUMN_NAME,
                    ORDINAL_POSITION,
                    REFERENCED_TABLE_SCHEMA,
                    REFERENCED_TABLE_NAME,
                    REFERENCED_COLUMN_NAME
                 FROM information_schema.KEY_COLUMN_USAGE
                 WHERE TABLE_SCHEMA = '{}'
                   AND REFERENCED_TABLE_NAME IS NOT NULL
                 ORDER BY TABLE_NAME, CONSTRAINT_NAME, ORDINAL_POSITION",
                    database.replace('\'', "''"),
                )
                .as_str(),
            )
            .await?;

        use std::collections::BTreeMap;

        let mut relation_map: BTreeMap<
            (String, String, String, String, String),
            ForeignKeyRelation,
        > = BTreeMap::new();

        for row in rows {
            let name: String = row.try_get(0).unwrap_or_default();
            let source_schema: String = row.try_get(1).unwrap_or_else(|_| database.to_string());
            let source_table: String = row.try_get(2).unwrap_or_default();
            let source_column: String = row.try_get(3).unwrap_or_default();
            let target_schema: String = row.try_get(5).unwrap_or_else(|_| database.to_string());
            let target_table: String = row.try_get(6).unwrap_or_default();
            let target_column: String = row.try_get(7).unwrap_or_default();

            let key = (
                source_schema.clone(),
                source_table.clone(),
                name.clone(),
                target_schema.clone(),
                target_table.clone(),
            );

            let relation = relation_map
                .entry(key)
                .or_insert_with(|| ForeignKeyRelation {
                    name: name.clone(),
                    source_table: source_table.clone(),
                    source_schema: Some(source_schema.clone()),
                    source_columns: Vec::new(),
                    target_table: target_table.clone(),
                    target_schema: Some(target_schema.clone()),
                    target_columns: Vec::new(),
                });

            relation.source_columns.push(source_column);
            relation.target_columns.push(target_column);
        }

        Ok(relation_map.into_values().collect())
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
            return Ok(QueryResult {
                columns: vec![],
                rows: vec![],
                execution_time_ms: duration,
            });
        }

        let columns = rows[0]
            .columns()
            .iter()
            .map(|c| c.name().to_string())
            .collect::<Vec<_>>();
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
                    serde_json::Value::Number(
                        serde_json::Number::from_f64(f as f64).unwrap_or(0.into()),
                    )
                } else if let Ok(b) = row.try_get::<bool, _>(i) {
                    serde_json::Value::Bool(b)
                } else if let Ok(dt) = row.try_get::<sqlx::types::chrono::NaiveDateTime, _>(i) {
                    serde_json::Value::String(dt.to_string())
                } else if let Ok(dt) =
                    row.try_get::<sqlx::types::chrono::DateTime<sqlx::types::chrono::Utc>, _>(i)
                {
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

    async fn get_table_data(
        &self,
        database: &str,
        table: &str,
        page: u32,
        page_size: u32,
    ) -> Result<QueryResult> {
        let pool_lock = self.pool.read().await;
        if let Some(pool) = pool_lock.as_ref() {
            // Re-verify the database connection session
            if let Err(e) = pool.execute(format!("USE `{}`", database).as_str()).await {
                println!("Warning: Failed to switch to database {}: {}", database, e);
            }
        }
        let query = format!(
            "SELECT * FROM `{}`.`{}` LIMIT {} OFFSET {}",
            database,
            table,
            page_size,
            page * page_size
        );
        self.run_query(&query).await
    }
}

use async_trait::async_trait;
use redis::Client;
use crate::types::*;
use crate::db::DatabaseDriver;
use anyhow::{Result, anyhow};
use std::time::Instant;

pub struct RedisDriver {
    pub client: tokio::sync::RwLock<Option<Client>>,
}

impl RedisDriver {
    pub fn new() -> Self {
        Self {
            client: tokio::sync::RwLock::new(None),
        }
    }
}

#[async_trait]
impl DatabaseDriver for RedisDriver {
    async fn connect(&self, config: &ConnectionConfig) -> Result<()> {
        let url = if let Some(uri) = &config.uri {
            uri.clone()
        } else {
            let host = config.host.as_deref().unwrap_or("localhost");
            let port = config.port.unwrap_or(6379);
            // Redis DB index must be a number (0-15); fall back to 0 if missing or non-numeric
            let db: u8 = config.database.as_deref()
                .unwrap_or("0")
                .parse()
                .unwrap_or(0);
            match (config.user.as_deref(), config.password.as_deref()) {
                // Both username and password
                (Some(user), Some(pass)) if !user.is_empty() && !pass.is_empty() =>
                    format!("redis://{}:{}@{}:{}/{}", user, pass, host, port, db),
                // Password only (most common for Redis AUTH)
                (_, Some(pass)) if !pass.is_empty() =>
                    format!("redis://:{}@{}:{}/{}", pass, host, port, db),
                // No credentials
                _ =>
                    format!("redis://{}:{}/{}", host, port, db),
            }
        };

        let client = Client::open(url)?;
        // Ping to check connection
        let mut conn = client.get_multiplexed_async_connection().await?;
        let _: String = redis::cmd("PING").query_async(&mut conn).await?;

        let mut client_lock = self.client.write().await;
        *client_lock = Some(client);
        Ok(())
    }

    async fn disconnect(&self) -> Result<()> {
        let mut client_lock = self.client.write().await;
        *client_lock = None;
        Ok(())
    }

    async fn get_databases(&self) -> Result<Vec<String>> {
        let client = {
            let client_lock = self.client.read().await;
            client_lock.as_ref().ok_or_else(|| anyhow!("Not connected"))?.clone()
        };
        let mut conn = client.get_multiplexed_async_connection().await?;
        let info: String = redis::cmd("INFO").arg("keyspace").query_async(&mut conn).await?;

        // Parse lines like "db1:keys=3,expires=0,..."
        let mut dbs: Vec<u32> = info.lines()
            .filter(|l| l.starts_with("db"))
            .filter_map(|l| l.trim_start_matches("db").split(':').next()?.parse().ok())
            .collect();
        dbs.sort();

        // Always include db0 as a fallback so there's at least one entry
        if dbs.is_empty() {
            dbs.push(0);
        }

        Ok(dbs.into_iter().map(|i| i.to_string()).collect())
    }

    async fn get_schemas(&self, _database: &str) -> Result<Vec<String>> {
        Ok(vec!["keyspace".to_string()])
    }

    async fn get_tables(&self, database: &str, _schema: Option<&str>) -> Result<Vec<TableInfo>> {
        let client = {
            let client_lock = self.client.read().await;
            client_lock.as_ref().ok_or_else(|| anyhow!("Not connected"))?.clone()
        };
        let mut conn = client.get_multiplexed_async_connection().await?;

        // Switch to the requested database index
        let db_idx: i64 = database.parse().unwrap_or(0);
        let _: () = redis::cmd("SELECT").arg(db_idx).query_async(&mut conn).await?;

        let mut keys: Vec<String> = redis::cmd("KEYS").arg("*").query_async(&mut conn).await?;
        keys.sort();
        Ok(keys.into_iter().map(|k| TableInfo { name: k, schema: None, columns: None }).collect())
    }

    async fn get_columns(&self, _database: &str, _table: &str, _schema: Option<&str>) -> Result<Vec<ColumnInfo>> {
        Ok(vec![])
    }

    async fn run_query(&self, query: &str) -> Result<QueryResult> {
        let client = {
            let client_lock = self.client.read().await;
            client_lock.as_ref().ok_or_else(|| anyhow!("Not connected"))?.clone()
        };
        let mut conn = client.get_multiplexed_async_connection().await?;

        let start = Instant::now();
        // This is a very basic command execution
        // Real implementation would parse the query into command and args
        let parts: Vec<&str> = query.split_whitespace().collect();
        if parts.is_empty() {
            return Err(anyhow!("Empty query"));
        }

        let mut cmd = redis::cmd(parts[0]);
        for part in &parts[1..] {
            cmd.arg(part);
        }

        let val: redis::Value = cmd.query_async(&mut conn).await?;
        let duration = start.elapsed().as_millis() as u64;

        Ok(QueryResult {
            columns: vec!["value".to_string()],
            rows: vec![serde_json::to_value(format!("{:?}", val))?],
            execution_time_ms: duration,
        })
    }

    async fn get_table_data(&self, database: &str, _table: &str, page: u32, page_size: u32) -> Result<QueryResult> {
        let client = {
            let client_lock = self.client.read().await;
            client_lock.as_ref().ok_or_else(|| anyhow!("Not connected"))?.clone()
        };
        let mut conn = client.get_multiplexed_async_connection().await?;
        let start = Instant::now();

        let db_idx: i64 = database.parse().unwrap_or(0);
        let _: () = redis::cmd("SELECT").arg(db_idx).query_async(&mut conn).await?;

        // Get all keys sorted, then paginate
        let mut all_keys: Vec<String> = redis::cmd("KEYS").arg("*").query_async(&mut conn).await?;
        all_keys.sort();

        let offset = (page * page_size) as usize;
        let page_keys: Vec<String> = all_keys.into_iter().skip(offset).take(page_size as usize).collect();

        let columns = vec![
            "key".to_string(), "value".to_string(), "type".to_string(),
            "encoding".to_string(), "ttl".to_string(), "memory".to_string(),
        ];

        let mut rows = Vec::new();
        for key in &page_keys {
            let key_type: String = redis::cmd("TYPE").arg(key).query_async(&mut conn).await.unwrap_or_else(|_| "unknown".to_string());

            let value: String = match key_type.as_str() {
                "string" => redis::cmd("GET").arg(key).query_async(&mut conn).await.unwrap_or_default(),
                "hash" => {
                    let len: i64 = redis::cmd("HLEN").arg(key).query_async(&mut conn).await.unwrap_or(0);
                    format!("({len} fields)")
                }
                "list" => {
                    let len: i64 = redis::cmd("LLEN").arg(key).query_async(&mut conn).await.unwrap_or(0);
                    format!("({len} items)")
                }
                "set" => {
                    let len: i64 = redis::cmd("SCARD").arg(key).query_async(&mut conn).await.unwrap_or(0);
                    format!("({len} members)")
                }
                "zset" => {
                    let len: i64 = redis::cmd("ZCARD").arg(key).query_async(&mut conn).await.unwrap_or(0);
                    format!("({len} members)")
                }
                "stream" => {
                    let len: i64 = redis::cmd("XLEN").arg(key).query_async(&mut conn).await.unwrap_or(0);
                    format!("({len} entries)")
                }
                _ => String::new(),
            };

            let encoding: String = redis::cmd("OBJECT").arg("ENCODING").arg(key)
                .query_async(&mut conn).await.unwrap_or_else(|_| "unknown".to_string());
            let ttl: i64 = redis::cmd("TTL").arg(key).query_async(&mut conn).await.unwrap_or(-1);
            let memory: i64 = redis::cmd("MEMORY").arg("USAGE").arg(key)
                .query_async(&mut conn).await.unwrap_or(0);

            rows.push(serde_json::json!({
                "key": key,
                "value": value,
                "type": key_type,
                "encoding": encoding,
                "ttl": ttl,
                "memory": memory,
            }));
        }

        let duration = start.elapsed().as_millis() as u64;
        Ok(QueryResult { columns, rows, execution_time_ms: duration })
    }
}

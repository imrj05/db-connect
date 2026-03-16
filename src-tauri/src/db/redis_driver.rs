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
            format!(
                "redis://{}:{}@{}:{}/{}",
                config.user.as_deref().unwrap_or(""),
                config.password.as_deref().unwrap_or(""),
                config.host.as_deref().unwrap_or("localhost"),
                config.port.unwrap_or(6379),
                config.database.as_deref().unwrap_or("0")
            )
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
        // Redis typically has 16 databases by default
        Ok((0..16).map(|i| i.to_string()).collect())
    }

    async fn get_schemas(&self, _database: &str) -> Result<Vec<String>> {
        Ok(vec!["keyspace".to_string()])
    }

    async fn get_tables(&self, _database: &str, _schema: Option<&str>) -> Result<Vec<TableInfo>> {
        // For Redis, we can think of keys as "tables" or just list them
        Ok(vec![])
    }

    async fn get_columns(&self, _database: &str, _table: &str, _schema: Option<&str>) -> Result<Vec<ColumnInfo>> {
        Ok(vec![])
    }

    async fn run_query(&self, query: &str) -> Result<QueryResult> {
        let client_lock = self.client.read().await;
        let client = client_lock.as_ref().ok_or_else(|| anyhow!("Not connected"))?;
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

    async fn get_table_data(&self, _database: &str, _table: &str, _page: u32, _page_size: u32) -> Result<QueryResult> {
        Ok(QueryResult {
            columns: vec![],
            rows: vec![],
            execution_time_ms: 0,
        })
    }
}

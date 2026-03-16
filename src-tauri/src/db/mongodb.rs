use async_trait::async_trait;
use mongodb::{Client, options::ClientOptions, bson::doc};
use crate::types::*;
use crate::db::DatabaseDriver;
use anyhow::{Result, anyhow};

pub struct MongoDriver {
    pub client: tokio::sync::RwLock<Option<Client>>,
}

impl MongoDriver {
    pub fn new() -> Self {
        Self {
            client: tokio::sync::RwLock::new(None),
        }
    }
}

#[async_trait]
impl DatabaseDriver for MongoDriver {
    async fn connect(&self, config: &ConnectionConfig) -> Result<()> {
        let uri = config.uri.as_deref().ok_or_else(|| anyhow!("MongoDB URI required"))?;
        let options = ClientOptions::parse(uri).await?;
        let client = Client::with_options(options)?;
        
        // Ping the server to verify connection
        client.database("admin").run_command(doc! {"ping": 1}, None).await?;
        
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
        let client_lock = self.client.read().await;
        let client = client_lock.as_ref().ok_or_else(|| anyhow!("Not connected"))?;
        
        Ok(client.list_database_names(None, None).await?)
    }

    async fn get_schemas(&self, _database: &str) -> Result<Vec<String>> {
        Ok(vec!["collection".to_string()])
    }

    async fn get_tables(&self, database: &str, _schema: Option<&str>) -> Result<Vec<TableInfo>> {
        let client_lock = self.client.read().await;
        let client = client_lock.as_ref().ok_or_else(|| anyhow!("Not connected"))?;
        
        let db = client.database(database);
        let collections = db.list_collection_names(None).await?;
        
        Ok(collections.into_iter().map(|name| TableInfo {
            name,
            schema: None,
            columns: None,
        }).collect())
    }

    async fn get_columns(&self, _database: &str, _table: &str, _schema: Option<&str>) -> Result<Vec<ColumnInfo>> {
        // MongoDB is schema-less, return empty or sample columns if needed
        Ok(vec![])
    }

    async fn run_query(&self, _query_str: &str) -> Result<QueryResult> {
        // This is a placeholder for running a find or command
        // Real implementation would parse query_str as JSON
        Ok(QueryResult {
            columns: vec!["document".to_string()],
            rows: vec![],
            execution_time_ms: 0,
        })
    }

    async fn get_table_data(&self, _table: &str, _page: u32, _page_size: u32) -> Result<QueryResult> {
        // Placeholder for fetching documents from a collection
        Ok(QueryResult {
            columns: vec!["document".to_string()],
            rows: vec![],
            execution_time_ms: 0,
        })
    }
}

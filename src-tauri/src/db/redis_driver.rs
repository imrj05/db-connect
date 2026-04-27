use crate::db::DatabaseDriver;
use crate::types::*;
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use redis::Client;
use std::collections::HashSet;
use std::time::Instant;

pub struct RedisDriver {
    pub client: tokio::sync::RwLock<Option<Client>>,
    /// Tracks the last-used DB index so run_query can SELECT the right DB.
    pub current_db: tokio::sync::RwLock<i64>,
}

impl RedisDriver {
    pub fn new() -> Self {
        Self {
            client: tokio::sync::RwLock::new(None),
            current_db: tokio::sync::RwLock::new(0),
        }
    }
}

fn redis_value_to_json(value: &redis::Value) -> serde_json::Value {
    match value {
        redis::Value::Nil => serde_json::Value::Null,
        redis::Value::Int(n) => serde_json::json!(n),
        redis::Value::Data(bytes) => String::from_utf8_lossy(bytes).to_string().into(),
        redis::Value::Bulk(items) => {
            serde_json::Value::Array(items.iter().map(redis_value_to_json).collect())
        }
        redis::Value::Status(status) => status.clone().into(),
        redis::Value::Okay => "OK".into(),
    }
}

async fn scan_all_keys(
    conn: &mut redis::aio::MultiplexedConnection,
) -> Result<Vec<String>> {
    let mut cursor: u64 = 0;
    let mut seen = HashSet::new();
    let mut keys = Vec::new();

    loop {
        let (next_cursor, batch): (u64, Vec<String>) = redis::cmd("SCAN")
            .arg(cursor)
            .query_async(conn)
            .await?;

        for key in batch {
            if seen.insert(key.clone()) {
                keys.push(key);
            }
        }

        if next_cursor == 0 {
            break;
        }

        cursor = next_cursor;
    }

    Ok(keys)
}

// ── SQL → Redis translators ────────────────────────────────────────────────────

fn sql_unquote_name(s: &str) -> String {
    let s = s.trim();
    if s.len() >= 2
        && ((s.starts_with('"') && s.ends_with('"')) || (s.starts_with('`') && s.ends_with('`')))
    {
        s[1..s.len() - 1].replace("\"\"", "\"").replace("``", "`")
    } else {
        s.to_string()
    }
}

fn sql_unquote_value(s: &str) -> Option<String> {
    let s = s.trim();
    if s.eq_ignore_ascii_case("null") {
        None
    } else if s.len() >= 2 && s.starts_with('\'') && s.ends_with('\'') {
        Some(s[1..s.len() - 1].replace("''", "'"))
    } else {
        Some(s.to_string())
    }
}

/// Parse `UPDATE "table" SET "col" = 'val' [WHERE "key" = 'keyname' ...]`
/// Returns `(redis_key, column, value)` — `value` is `None` for SQL NULL.
fn parse_redis_update(query: &str) -> Option<(String, String, Option<String>)> {
    let q = query.trim();
    let upper = q.to_ascii_uppercase();
    if !upper.starts_with("UPDATE ") {
        return None;
    }
    let set_pos = upper.find(" SET ")?;
    let table_name = sql_unquote_name(q[7..set_pos].trim());

    let after_set = &q[set_pos + 5..];
    let upper_after = after_set.to_ascii_uppercase();
    let where_pos = upper_after.find(" WHERE ");

    let set_clause = match where_pos {
        Some(p) => after_set[..p].trim(),
        None => after_set.trim(),
    };
    let where_str = where_pos.map(|p| &after_set[p + 7..]);

    // Parse SET col = val
    let eq_pos = set_clause.find('=')?;
    let col = sql_unquote_name(set_clause[..eq_pos].trim());
    let val = sql_unquote_value(set_clause[eq_pos + 1..].trim());

    // Extract actual Redis key from WHERE "key" = 'keyname'
    let redis_key = if let Some(ws) = where_str {
        extract_key_from_where(ws).unwrap_or(table_name)
    } else {
        table_name
    };

    Some((redis_key, col, val))
}

/// Parse `DELETE FROM "table" WHERE "key" = 'keyname' [AND ...]`
/// Returns the Redis key to delete.
fn parse_redis_delete(query: &str) -> Option<String> {
    let q = query.trim();
    let upper = q.to_ascii_uppercase();
    if !upper.starts_with("DELETE FROM ") {
        return None;
    }
    let where_pos = upper.find(" WHERE ")?;
    let table_name = sql_unquote_name(q[12..where_pos].trim());
    let where_str = &q[where_pos + 7..];
    Some(extract_key_from_where(where_str).unwrap_or(table_name))
}

/// Find `"key" = 'value'` (or `key = 'value'`) within a WHERE clause and return the value.
fn extract_key_from_where(where_str: &str) -> Option<String> {
    let upper = where_str.to_ascii_uppercase();
    // Look for the key column in quoted or unquoted form
    let search_terms = [r#""KEY""#, "`KEY`", "KEY "];
    for term in &search_terms {
        if let Some(kpos) = upper.find(term) {
            let after = &where_str[kpos + term.len()..];
            let upper_after = after.to_ascii_uppercase();
            // Skip whitespace and find '='
            let trimmed = upper_after.trim_start();
            if trimmed.starts_with('=') || trimmed.starts_with("= ") {
                let eq = after.find('=')?;
                let after_eq = after[eq + 1..].trim();
                // Value ends at AND or end of string
                let end = after_eq
                    .to_ascii_uppercase()
                    .find(" AND ")
                    .unwrap_or(after_eq.len());
                return sql_unquote_value(after_eq[..end].trim());
            }
        }
    }
    None
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
            let db: u8 = config
                .database
                .as_deref()
                .unwrap_or("0")
                .parse()
                .unwrap_or(0);
            let scheme = if config.ssl.unwrap_or(false) {
                "rediss"
            } else {
                "redis"
            };
            match (config.user.as_deref(), config.password.as_deref()) {
                // Both username and password
                (Some(user), Some(pass)) if !user.is_empty() && !pass.is_empty() => {
                    format!("{}://{}:{}@{}:{}/{}", scheme, user, pass, host, port, db)
                }
                // Password only (most common for Redis AUTH)
                (_, Some(pass)) if !pass.is_empty() => {
                    format!("{}://:{}@{}:{}/{}", scheme, pass, host, port, db)
                }
                // No credentials
                _ => format!("{}://{}:{}/{}", scheme, host, port, db),
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
            client_lock
                .as_ref()
                .ok_or_else(|| anyhow!("Not connected"))?
                .clone()
        };
        let mut conn = client.get_multiplexed_async_connection().await?;
        let info: String = redis::cmd("INFO")
            .arg("keyspace")
            .query_async(&mut conn)
            .await?;

        // Parse lines like "db1:keys=3,expires=0,..."
        let mut dbs: Vec<u32> = info
            .lines()
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
            client_lock
                .as_ref()
                .ok_or_else(|| anyhow!("Not connected"))?
                .clone()
        };
        let mut conn = client.get_multiplexed_async_connection().await?;

        // Switch to the requested database index and remember it for run_query.
        let db_idx: i64 = database.parse().unwrap_or(0);
        *self.current_db.write().await = db_idx;
        let _: () = redis::cmd("SELECT")
            .arg(db_idx)
            .query_async(&mut conn)
            .await?;

        let mut keys = scan_all_keys(&mut conn).await?;
        keys.sort();
        Ok(keys
            .into_iter()
            .map(|k| TableInfo {
                name: k,
                schema: None,
                columns: None,
            })
            .collect())
    }

    async fn get_columns(
        &self,
        _database: &str,
        _table: &str,
        _schema: Option<&str>,
    ) -> Result<Vec<ColumnInfo>> {
        Ok(vec![])
    }

    async fn run_query(&self, query: &str) -> Result<QueryResult> {
        let client = {
            let client_lock = self.client.read().await;
            client_lock
                .as_ref()
                .ok_or_else(|| anyhow!("Not connected"))?
                .clone()
        };
        let mut conn = client.get_multiplexed_async_connection().await?;

        // Restore the last-used database index so edits land in the right DB.
        let db_idx = *self.current_db.read().await;
        let _: () = redis::cmd("SELECT")
            .arg(db_idx)
            .query_async(&mut conn)
            .await?;

        let start = Instant::now();
        let upper_trim = query.trim().to_ascii_uppercase();

        // ── Translate SQL UPDATE → Redis SET / EXPIRE ────────────────────────
        if upper_trim.starts_with("UPDATE ") {
            if let Some((key, col, val)) = parse_redis_update(query) {
                match col.to_lowercase().as_str() {
                    "value" => {
                        if let Some(v) = val {
                            let _: () = redis::cmd("SET")
                                .arg(&key)
                                .arg(&v)
                                .query_async(&mut conn)
                                .await?;
                        }
                        // NULL → leave key unchanged (Redis has no concept of a null string value)
                    }
                    "ttl" => {
                        if let Some(v) = val {
                            let seconds: i64 = v.parse().unwrap_or(-1);
                            if seconds < 0 {
                                let _: () = redis::cmd("PERSIST")
                                    .arg(&key)
                                    .query_async(&mut conn)
                                    .await?;
                            } else {
                                let _: () = redis::cmd("EXPIRE")
                                    .arg(&key)
                                    .arg(seconds)
                                    .query_async(&mut conn)
                                    .await?;
                            }
                        }
                    }
                    _ => {} // type / encoding / memory are read-only metadata
                }
                let duration = start.elapsed().as_millis() as u64;
                return Ok(QueryResult {
                    columns: vec!["result".to_string()],
                    rows: vec![serde_json::json!({"result": "OK"})],
                    execution_time_ms: duration,
                });
            }
        }

        // ── Translate SQL DELETE FROM → Redis DEL ────────────────────────────
        if upper_trim.starts_with("DELETE FROM ") {
            if let Some(key) = parse_redis_delete(query) {
                let _: () = redis::cmd("DEL").arg(&key).query_async(&mut conn).await?;
                let duration = start.elapsed().as_millis() as u64;
                return Ok(QueryResult {
                    columns: vec!["result".to_string()],
                    rows: vec![serde_json::json!({"result": "OK"})],
                    execution_time_ms: duration,
                });
            }
        }

        // ── Generic Redis command passthrough ────────────────────────────────
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
            rows: vec![serde_json::json!({ "value": redis_value_to_json(&val) })],
            execution_time_ms: duration,
        })
    }

    async fn get_table_data(
        &self,
        database: &str,
        _table: &str,
        page: u32,
        page_size: u32,
    ) -> Result<QueryResult> {
        let client = {
            let client_lock = self.client.read().await;
            client_lock
                .as_ref()
                .ok_or_else(|| anyhow!("Not connected"))?
                .clone()
        };
        let mut conn = client.get_multiplexed_async_connection().await?;
        let start = Instant::now();

        let db_idx: i64 = database.parse().unwrap_or(0);
        *self.current_db.write().await = db_idx;
        let _: () = redis::cmd("SELECT")
            .arg(db_idx)
            .query_async(&mut conn)
            .await?;

        // Scan keys incrementally to avoid blocking Redis instances with large keyspaces.
        let mut all_keys = scan_all_keys(&mut conn).await?;
        all_keys.sort();

        let offset = (page * page_size) as usize;
        let page_keys: Vec<String> = all_keys
            .into_iter()
            .skip(offset)
            .take(page_size as usize)
            .collect();

        let columns = vec![
            "key".to_string(),
            "value".to_string(),
            "type".to_string(),
            "encoding".to_string(),
            "ttl".to_string(),
            "memory".to_string(),
        ];

        let mut rows = Vec::new();
        for key in &page_keys {
            let key_type: String = redis::cmd("TYPE")
                .arg(key)
                .query_async(&mut conn)
                .await
                .unwrap_or_else(|_| "unknown".to_string());

            let value: String = match key_type.as_str() {
                "string" => redis::cmd("GET")
                    .arg(key)
                    .query_async(&mut conn)
                    .await
                    .unwrap_or_default(),
                "hash" => {
                    let len: i64 = redis::cmd("HLEN")
                        .arg(key)
                        .query_async(&mut conn)
                        .await
                        .unwrap_or(0);
                    format!("({len} fields)")
                }
                "list" => {
                    let len: i64 = redis::cmd("LLEN")
                        .arg(key)
                        .query_async(&mut conn)
                        .await
                        .unwrap_or(0);
                    format!("({len} items)")
                }
                "set" => {
                    let len: i64 = redis::cmd("SCARD")
                        .arg(key)
                        .query_async(&mut conn)
                        .await
                        .unwrap_or(0);
                    format!("({len} members)")
                }
                "zset" => {
                    let len: i64 = redis::cmd("ZCARD")
                        .arg(key)
                        .query_async(&mut conn)
                        .await
                        .unwrap_or(0);
                    format!("({len} members)")
                }
                "stream" => {
                    let len: i64 = redis::cmd("XLEN")
                        .arg(key)
                        .query_async(&mut conn)
                        .await
                        .unwrap_or(0);
                    format!("({len} entries)")
                }
                _ => String::new(),
            };

            let encoding: String = redis::cmd("OBJECT")
                .arg("ENCODING")
                .arg(key)
                .query_async(&mut conn)
                .await
                .unwrap_or_else(|_| "unknown".to_string());
            let ttl: i64 = redis::cmd("TTL")
                .arg(key)
                .query_async(&mut conn)
                .await
                .unwrap_or(-1);
            let memory: i64 = redis::cmd("MEMORY")
                .arg("USAGE")
                .arg(key)
                .query_async(&mut conn)
                .await
                .unwrap_or(0);

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
        Ok(QueryResult {
            columns,
            rows,
            execution_time_ms: duration,
        })
    }
}

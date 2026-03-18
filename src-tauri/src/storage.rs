//! Persistent storage: SQLite + AES-256-GCM encrypted passwords.
//!
//! The encryption key is generated once and written to `{app_data_dir}/storage.key`
//! as hex. The SQLite database lives at `{app_data_dir}/storage.db`.
//! Passwords are never stored in plaintext — only the AES-GCM ciphertext
//! (nonce prepended, then base64-encoded) is written to disk.

use std::path::PathBuf;
use std::sync::OnceLock;

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use anyhow::Result;
use base64::{engine::general_purpose::STANDARD, Engine};
use rand::RngCore;
use sqlx::{sqlite::SqliteConnectOptions, Pool, Row, Sqlite};

use crate::types::{ConnectionConfig, DatabaseType, SavedQuery};

// ── Global singleton ───────────────────────────────────────────────────────────

static STORAGE: OnceLock<AppStorage> = OnceLock::new();

pub struct AppStorage {
    pool: Pool<Sqlite>,
    cipher: Aes256Gcm,
}

// Safety: Aes256Gcm holds only stack-allocated byte arrays — Send + Sync.
unsafe impl Send for AppStorage {}
unsafe impl Sync for AppStorage {}

// ── Init ───────────────────────────────────────────────────────────────────────

impl AppStorage {
    pub async fn init(data_dir: PathBuf) -> Result<()> {
        tokio::fs::create_dir_all(&data_dir).await?;

        // ── Encryption key ────────────────────────────────────────────────────
        let key_path = data_dir.join("storage.key");
        let key_bytes: Vec<u8> = if key_path.exists() {
            let hex_str = tokio::fs::read_to_string(&key_path).await?;
            hex::decode(hex_str.trim())?
        } else {
            let mut key = vec![0u8; 32];
            rand::thread_rng().fill_bytes(&mut key);
            tokio::fs::write(&key_path, hex::encode(&key)).await?;
            key
        };

        let cipher = Aes256Gcm::new_from_slice(&key_bytes)
            .map_err(|e| anyhow::anyhow!("Bad key length: {}", e))?;

        // ── SQLite pool ───────────────────────────────────────────────────────
        let db_path = data_dir.join("storage.db");
        let opts = SqliteConnectOptions::new()
            .filename(&db_path)
            .create_if_missing(true);
        let pool: Pool<Sqlite> = Pool::connect_with(opts).await?;

        // ── Schema ────────────────────────────────────────────────────────────
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS connections (
                id                 TEXT PRIMARY KEY,
                name               TEXT NOT NULL,
                prefix             TEXT NOT NULL,
                db_type            TEXT NOT NULL,
                host               TEXT,
                port               INTEGER,
                username           TEXT,
                database_name      TEXT,
                schema_name        TEXT,
                ssl                INTEGER NOT NULL DEFAULT 0,
                uri                TEXT,
                encrypted_password TEXT,
                created_at         TEXT DEFAULT (datetime('now'))
            )",
        )
        .execute(&pool)
        .await?;

        sqlx::query(
            "CREATE TABLE IF NOT EXISTS saved_queries (
                id            TEXT PRIMARY KEY,
                name          TEXT NOT NULL,
                sql_text      TEXT NOT NULL,
                connection_id TEXT,
                created_at    INTEGER NOT NULL
            )",
        )
        .execute(&pool)
        .await?;

        STORAGE
            .set(AppStorage { pool, cipher })
            .map_err(|_| anyhow::anyhow!("Storage already initialised"))?;

        Ok(())
    }

    pub fn get() -> &'static AppStorage {
        STORAGE.get().expect("Storage::init() not called")
    }

    // ── Crypto helpers ────────────────────────────────────────────────────────

    fn encrypt(&self, plaintext: &str) -> Result<String> {
        if plaintext.is_empty() {
            return Ok(String::new());
        }
        let mut nonce_bytes = [0u8; 12];
        rand::thread_rng().fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);
        let ciphertext = self
            .cipher
            .encrypt(nonce, plaintext.as_bytes())
            .map_err(|e| anyhow::anyhow!("Encrypt: {}", e))?;
        let mut combined = nonce_bytes.to_vec();
        combined.extend_from_slice(&ciphertext);
        Ok(STANDARD.encode(combined))
    }

    fn decrypt(&self, encoded: &str) -> Result<String> {
        if encoded.is_empty() {
            return Ok(String::new());
        }
        let combined = STANDARD.decode(encoded)?;
        if combined.len() < 12 {
            return Err(anyhow::anyhow!("Encrypted blob too short"));
        }
        let (nonce_bytes, ciphertext) = combined.split_at(12);
        let nonce = Nonce::from_slice(nonce_bytes);
        let plaintext = self
            .cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| anyhow::anyhow!("Decrypt: {}", e))?;
        Ok(String::from_utf8(plaintext)?)
    }

    // ── Connection CRUD ───────────────────────────────────────────────────────

    pub async fn save_connection(&self, conn: &ConnectionConfig) -> Result<()> {
        let db_type = db_type_to_str(&conn.db_type);
        let encrypted_pw = match &conn.password {
            Some(pw) if !pw.is_empty() => Some(self.encrypt(pw)?),
            _ => None,
        };
        let ssl_int: i64 = conn.ssl.unwrap_or(false) as i64;

        sqlx::query(
            "INSERT INTO connections
                (id, name, prefix, db_type, host, port, username,
                 database_name, schema_name, ssl, uri, encrypted_password)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
                name               = excluded.name,
                prefix             = excluded.prefix,
                db_type            = excluded.db_type,
                host               = excluded.host,
                port               = excluded.port,
                username           = excluded.username,
                database_name      = excluded.database_name,
                schema_name        = excluded.schema_name,
                ssl                = excluded.ssl,
                uri                = excluded.uri,
                encrypted_password = excluded.encrypted_password",
        )
        .bind(&conn.id)
        .bind(&conn.name)
        .bind(&conn.prefix)
        .bind(db_type)
        .bind(&conn.host)
        .bind(conn.port.map(|p| p as i64))
        .bind(&conn.user)
        .bind(&conn.database)
        .bind(&conn.schema)
        .bind(ssl_int)
        .bind(&conn.uri)
        .bind(&encrypted_pw)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn load_connections(&self) -> Result<Vec<ConnectionConfig>> {
        let rows = sqlx::query(
            "SELECT id, name, prefix, db_type, host, port, username,
                    database_name, schema_name, ssl, uri, encrypted_password
             FROM connections ORDER BY created_at ASC",
        )
        .fetch_all(&self.pool)
        .await?;

        let mut result = Vec::with_capacity(rows.len());
        for row in rows {
            let db_type_str: String = row.get("db_type");
            let db_type = db_type_from_str(&db_type_str)?;

            let encrypted_pw: Option<String> = row.get("encrypted_password");
            let password = match encrypted_pw {
                Some(ref enc) if !enc.is_empty() => Some(self.decrypt(enc)?),
                _ => None,
            };

            let port_i64: Option<i64> = row.get("port");
            let ssl_int: i64 = row.get("ssl");

            result.push(ConnectionConfig {
                id: row.get("id"),
                name: row.get("name"),
                prefix: row.get("prefix"),
                db_type,
                host: row.get("host"),
                port: port_i64.map(|p| p as u16),
                user: row.get("username"),
                password,
                database: row.get("database_name"),
                schema: row.get("schema_name"),
                ssl: Some(ssl_int != 0),
                uri: row.get("uri"),
            });
        }
        Ok(result)
    }

    pub async fn delete_connection(&self, id: &str) -> Result<()> {
        sqlx::query("DELETE FROM connections WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    // ── Saved query CRUD ──────────────────────────────────────────────────────

    pub async fn save_query(&self, query: &SavedQuery) -> Result<()> {
        sqlx::query(
            "INSERT INTO saved_queries (id, name, sql_text, connection_id, created_at)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
                name          = excluded.name,
                sql_text      = excluded.sql_text,
                connection_id = excluded.connection_id",
        )
        .bind(&query.id)
        .bind(&query.name)
        .bind(&query.sql)
        .bind(&query.connection_id)
        .bind(query.created_at)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn load_queries(&self) -> Result<Vec<SavedQuery>> {
        let rows = sqlx::query(
            "SELECT id, name, sql_text, connection_id, created_at
             FROM saved_queries ORDER BY created_at ASC",
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows
            .iter()
            .map(|row| SavedQuery {
                id: row.get("id"),
                name: row.get("name"),
                sql: row.get("sql_text"),
                connection_id: row.get("connection_id"),
                created_at: row.get("created_at"),
            })
            .collect())
    }

    pub async fn delete_query(&self, id: &str) -> Result<()> {
        sqlx::query("DELETE FROM saved_queries WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}

// ── DatabaseType helpers ───────────────────────────────────────────────────────

fn db_type_to_str(dt: &DatabaseType) -> &'static str {
    match dt {
        DatabaseType::Postgresql => "postgresql",
        DatabaseType::Mysql => "mysql",
        DatabaseType::Sqlite => "sqlite",
        DatabaseType::Mongodb => "mongodb",
        DatabaseType::Redis => "redis",
    }
}

fn db_type_from_str(s: &str) -> Result<DatabaseType> {
    match s {
        "postgresql" => Ok(DatabaseType::Postgresql),
        "mysql" => Ok(DatabaseType::Mysql),
        "sqlite" => Ok(DatabaseType::Sqlite),
        "mongodb" => Ok(DatabaseType::Mongodb),
        "redis" => Ok(DatabaseType::Redis),
        other => Err(anyhow::anyhow!("Unknown db type: {}", other)),
    }
}

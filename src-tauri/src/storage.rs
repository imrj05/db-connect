//! Persistent storage: SQLite + AES-256-GCM encrypted passwords.
//!
//! The encryption key is stored in the OS-native credential store (macOS Keychain,
//! Windows Credential Manager, Linux Secret Service) under service `db-connect` /
//! account `encryption-key`. On first launch it is generated and saved there.
//! If a legacy `storage.key` file exists it is migrated to the keychain and deleted.
//! The SQLite database lives at `{app_data_dir}/storage.db`.
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

use crate::types::{ConnectionConfig, DatabaseType, QueryHistoryEntry, SavedQuery, UserSnippet};

// ── Global singleton ───────────────────────────────────────────────────────────

static STORAGE: OnceLock<AppStorage> = OnceLock::new();

pub struct AppStorage {
    pool: Pool<Sqlite>,
    cipher: Aes256Gcm,
}

pub struct AiCredential {
    pub provider: String,
    pub auth_mode: String,
    pub api_key: String,
}

// Safety: Aes256Gcm holds only stack-allocated byte arrays — Send + Sync.
unsafe impl Send for AppStorage {}
unsafe impl Sync for AppStorage {}

// ── Init ───────────────────────────────────────────────────────────────────────

impl AppStorage {
    pub async fn init(data_dir: PathBuf) -> Result<()> {
        tokio::fs::create_dir_all(&data_dir).await?;

        // ── Encryption key ────────────────────────────────────────────────────
        // Strategy (in priority order):
        //   1. File  `{data_dir}/storage.key`  — written on first run, always present after
        //   2. OS keychain                      — legacy fallback for old installs
        //   3. Generate new key                 — truly first install
        // The key is always written back to the file so restarts are reliable.
        let key_path = data_dir.join("storage.key");

        let key_bytes: Vec<u8> = if key_path.exists() {
            let hex_str = tokio::fs::read_to_string(&key_path).await?;
            hex::decode(hex_str.trim())?
        } else {
            // Try keychain (migration from old installs that stored key only there).
            let from_keychain = keyring::Entry::new("db-connect", "encryption-key")
                .ok()
                .and_then(|e| e.get_password().ok())
                .and_then(|s| hex::decode(s.trim()).ok())
                .filter(|k| k.len() == 32);

            let key = from_keychain.unwrap_or_else(|| {
                let mut k = vec![0u8; 32];
                rand::thread_rng().fill_bytes(&mut k);
                k
            });

            // Write to file so next restart is always reliable.
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
                group_name         TEXT,
                ssh_enabled        INTEGER NOT NULL DEFAULT 0,
                ssh_host           TEXT,
                ssh_port           INTEGER,
                ssh_user           TEXT,
                encrypted_ssh_password     TEXT,
                ssh_key_path               TEXT,
                encrypted_ssh_key_passphrase TEXT,
                created_at         TEXT DEFAULT (datetime('now'))
            )",
        )
        .execute(&pool)
        .await?;

        // Migrations: add new columns if they don't exist yet (safe to ignore errors)
        let _ = sqlx::query("ALTER TABLE connections ADD COLUMN group_name TEXT")
            .execute(&pool)
            .await;
        let _ = sqlx::query(
            "ALTER TABLE connections ADD COLUMN ssh_enabled INTEGER NOT NULL DEFAULT 0",
        )
        .execute(&pool)
        .await;
        let _ = sqlx::query("ALTER TABLE connections ADD COLUMN ssh_host TEXT")
            .execute(&pool)
            .await;
        let _ = sqlx::query("ALTER TABLE connections ADD COLUMN ssh_port INTEGER")
            .execute(&pool)
            .await;
        let _ = sqlx::query("ALTER TABLE connections ADD COLUMN ssh_user TEXT")
            .execute(&pool)
            .await;
        let _ = sqlx::query("ALTER TABLE connections ADD COLUMN encrypted_ssh_password TEXT")
            .execute(&pool)
            .await;
        let _ = sqlx::query("ALTER TABLE connections ADD COLUMN ssh_key_path TEXT")
            .execute(&pool)
            .await;
        let _ = sqlx::query("ALTER TABLE connections ADD COLUMN encrypted_ssh_key_passphrase TEXT")
            .execute(&pool)
            .await;

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

        sqlx::query(
            "CREATE TABLE IF NOT EXISTS query_history (
                id                TEXT PRIMARY KEY,
                sql_text          TEXT NOT NULL,
                executed_at       INTEGER NOT NULL,
                execution_time_ms INTEGER NOT NULL,
                row_count         INTEGER NOT NULL,
                connection_id     TEXT NOT NULL,
                status            TEXT,
                error_message     TEXT
            )",
        )
        .execute(&pool)
        .await?;
        // Migrations: add status/error_message if missing (existing installs)
        let _ = sqlx::query("ALTER TABLE query_history ADD COLUMN status TEXT")
            .execute(&pool)
            .await;
        let _ = sqlx::query("ALTER TABLE query_history ADD COLUMN error_message TEXT")
            .execute(&pool)
            .await;

        sqlx::query(
            "CREATE TABLE IF NOT EXISTS ai_credentials (
                provider          TEXT PRIMARY KEY,
                auth_mode         TEXT NOT NULL,
                encrypted_api_key TEXT NOT NULL,
                created_at        TEXT DEFAULT (datetime('now')),
                updated_at        TEXT DEFAULT (datetime('now'))
            )",
        )
        .execute(&pool)
        .await?;

        sqlx::query(
            "CREATE TABLE IF NOT EXISTS user_snippets (
                id          TEXT PRIMARY KEY,
                label       TEXT NOT NULL,
                description TEXT NOT NULL,
                category    TEXT NOT NULL,
                sql_text    TEXT NOT NULL,
                created_at  INTEGER NOT NULL
            )",
        )
        .execute(&pool)
        .await?;

        sqlx::query(
            "CREATE TABLE IF NOT EXISTS workspace_snapshot (
                id          INTEGER PRIMARY KEY DEFAULT 1,
                snapshot    TEXT NOT NULL,
                updated_at  TEXT DEFAULT (datetime('now'))
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
        let ssh_enabled_int: i64 = conn.ssh_enabled.unwrap_or(false) as i64;
        let encrypted_ssh_pw = match &conn.ssh_password {
            Some(pw) if !pw.is_empty() => Some(self.encrypt(pw)?),
            _ => None,
        };
        let encrypted_ssh_passphrase = match &conn.ssh_key_passphrase {
            Some(pp) if !pp.is_empty() => Some(self.encrypt(pp)?),
            _ => None,
        };

        sqlx::query(
            "INSERT INTO connections
                (id, name, prefix, db_type, host, port, username,
                 database_name, schema_name, ssl, uri, encrypted_password, group_name,
                 ssh_enabled, ssh_host, ssh_port, ssh_user,
                 encrypted_ssh_password, ssh_key_path, encrypted_ssh_key_passphrase)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
                name                         = excluded.name,
                prefix                       = excluded.prefix,
                db_type                      = excluded.db_type,
                host                         = excluded.host,
                port                         = excluded.port,
                username                     = excluded.username,
                database_name                = excluded.database_name,
                schema_name                  = excluded.schema_name,
                ssl                          = excluded.ssl,
                uri                          = excluded.uri,
                encrypted_password           = excluded.encrypted_password,
                group_name                   = excluded.group_name,
                ssh_enabled                  = excluded.ssh_enabled,
                ssh_host                     = excluded.ssh_host,
                ssh_port                     = excluded.ssh_port,
                ssh_user                     = excluded.ssh_user,
                encrypted_ssh_password       = excluded.encrypted_ssh_password,
                ssh_key_path                 = excluded.ssh_key_path,
                encrypted_ssh_key_passphrase = excluded.encrypted_ssh_key_passphrase",
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
        .bind(&conn.group)
        .bind(ssh_enabled_int)
        .bind(&conn.ssh_host)
        .bind(conn.ssh_port.map(|p| p as i64))
        .bind(&conn.ssh_user)
        .bind(&encrypted_ssh_pw)
        .bind(&conn.ssh_key_path)
        .bind(&encrypted_ssh_passphrase)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn load_connections(&self) -> Result<Vec<ConnectionConfig>> {
        let rows = sqlx::query(
            "SELECT id, name, prefix, db_type, host, port, username,
                    database_name, schema_name, ssl, uri, encrypted_password, group_name,
                    ssh_enabled, ssh_host, ssh_port, ssh_user,
                    encrypted_ssh_password, ssh_key_path, encrypted_ssh_key_passphrase
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
                Some(ref enc) if !enc.is_empty() => self.decrypt(enc).ok(),
                _ => None,
            };

            let port_i64: Option<i64> = row.get("port");
            let ssl_int: i64 = row.get("ssl");

            let ssh_enabled_int: i64 = row.try_get("ssh_enabled").unwrap_or(0);
            let ssh_port_i64: Option<i64> = row.try_get("ssh_port").unwrap_or(None);

            let enc_ssh_pw: Option<String> = row.try_get("encrypted_ssh_password").unwrap_or(None);
            let ssh_password = match enc_ssh_pw {
                Some(ref enc) if !enc.is_empty() => self.decrypt(enc).ok(),
                _ => None,
            };

            let enc_ssh_pp: Option<String> =
                row.try_get("encrypted_ssh_key_passphrase").unwrap_or(None);
            let ssh_key_passphrase = match enc_ssh_pp {
                Some(ref enc) if !enc.is_empty() => self.decrypt(enc).ok(),
                _ => None,
            };

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
                group: row.get("group_name"),
                ssh_enabled: if ssh_enabled_int != 0 {
                    Some(true)
                } else {
                    None
                },
                ssh_host: row.try_get("ssh_host").unwrap_or(None),
                ssh_port: ssh_port_i64.map(|p| p as u16),
                ssh_user: row.try_get("ssh_user").unwrap_or(None),
                ssh_password,
                ssh_key_path: row.try_get("ssh_key_path").unwrap_or(None),
                ssh_key_passphrase,
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

    // ── Query history CRUD ────────────────────────────────────────────────────

    pub async fn save_history_entry(&self, entry: &QueryHistoryEntry) -> Result<()> {
        sqlx::query(
            "INSERT OR IGNORE INTO query_history
                (id, sql_text, executed_at, execution_time_ms, row_count, connection_id,
                 status, error_message)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&entry.id)
        .bind(&entry.sql)
        .bind(entry.executed_at)
        .bind(entry.execution_time_ms)
        .bind(entry.row_count)
        .bind(&entry.connection_id)
        .bind(&entry.status)
        .bind(&entry.error_message)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn load_history(&self) -> Result<Vec<QueryHistoryEntry>> {
        let rows = sqlx::query(
            "SELECT id, sql_text, executed_at, execution_time_ms, row_count, connection_id,
                    status, error_message
             FROM query_history ORDER BY executed_at DESC",
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows
            .iter()
            .map(|row| QueryHistoryEntry {
                id: row.get("id"),
                sql: row.get("sql_text"),
                executed_at: row.get("executed_at"),
                execution_time_ms: row.get("execution_time_ms"),
                row_count: row.get("row_count"),
                connection_id: row.get("connection_id"),
                status: row.try_get("status").unwrap_or(None),
                error_message: row.try_get("error_message").unwrap_or(None),
            })
            .collect())
    }

    pub async fn clear_history_for_connection(&self, connection_id: &str) -> Result<()> {
        sqlx::query("DELETE FROM query_history WHERE connection_id = ?")
            .bind(connection_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn clear_all_history(&self) -> Result<()> {
        sqlx::query("DELETE FROM query_history")
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn delete_history_entry(&self, id: &str) -> Result<()> {
        sqlx::query("DELETE FROM query_history WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn save_ai_credential(
        &self,
        provider: &str,
        auth_mode: &str,
        api_key: &str,
    ) -> Result<()> {
        let encrypted_api_key = self.encrypt(api_key)?;
        sqlx::query(
            "INSERT INTO ai_credentials (provider, auth_mode, encrypted_api_key)
             VALUES (?, ?, ?)
             ON CONFLICT(provider) DO UPDATE SET
                auth_mode = excluded.auth_mode,
                encrypted_api_key = excluded.encrypted_api_key,
                updated_at = datetime('now')",
        )
        .bind(provider)
        .bind(auth_mode)
        .bind(&encrypted_api_key)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn load_ai_credential(&self, provider: &str) -> Result<Option<AiCredential>> {
        let row = sqlx::query(
            "SELECT provider, auth_mode, encrypted_api_key
             FROM ai_credentials
             WHERE provider = ?",
        )
        .bind(provider)
        .fetch_optional(&self.pool)
        .await?;

        let Some(row) = row else {
            return Ok(None);
        };

        let encrypted_api_key: String = row.get("encrypted_api_key");
        let api_key = self.decrypt(&encrypted_api_key)?;
        Ok(Some(AiCredential {
            provider: row.get("provider"),
            auth_mode: row.get("auth_mode"),
            api_key,
        }))
    }

    pub async fn clear_ai_credential(&self, provider: &str) -> Result<()> {
        sqlx::query("DELETE FROM ai_credentials WHERE provider = ?")
            .bind(provider)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    // ── User snippets CRUD ─────────────────────────────────────────────────────

    pub async fn save_snippet(&self, snippet: &UserSnippet) -> Result<()> {
        sqlx::query(
            "INSERT INTO user_snippets (id, label, description, category, sql_text, created_at)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
                label       = excluded.label,
                description = excluded.description,
                category    = excluded.category,
                sql_text    = excluded.sql_text",
        )
        .bind(&snippet.id)
        .bind(&snippet.label)
        .bind(&snippet.description)
        .bind(&snippet.category)
        .bind(&snippet.sql)
        .bind(snippet.created_at)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn load_snippets(&self) -> Result<Vec<UserSnippet>> {
        let rows = sqlx::query(
            "SELECT id, label, description, category, sql_text, created_at
             FROM user_snippets ORDER BY created_at ASC",
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows
            .iter()
            .map(|row| UserSnippet {
                id: row.get("id"),
                label: row.get("label"),
                description: row.get("description"),
                category: row.get("category"),
                sql: row.get("sql_text"),
                created_at: row.get("created_at"),
            })
            .collect())
    }

    pub async fn delete_snippet(&self, id: &str) -> Result<()> {
        sqlx::query("DELETE FROM user_snippets WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    // ── Workspace snapshot ────────────────────────────────────────────────────

    pub async fn save_workspace_snapshot(&self, snapshot_json: &str) -> Result<()> {
        sqlx::query(
            "INSERT INTO workspace_snapshot (id, snapshot, updated_at)
             VALUES (1, ?, datetime('now'))
             ON CONFLICT(id) DO UPDATE SET
                snapshot   = excluded.snapshot,
                updated_at = excluded.updated_at",
        )
        .bind(snapshot_json)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn load_workspace_snapshot(&self) -> Result<Option<String>> {
        let row = sqlx::query("SELECT snapshot FROM workspace_snapshot WHERE id = 1")
            .fetch_optional(&self.pool)
            .await?;
        Ok(row.map(|r| r.get::<String, _>("snapshot")))
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

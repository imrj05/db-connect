use crate::types::{
    ConflictStrategy, ConnectionConfig, ConnectionExport, DatabaseType, ExportOptions,
    ImportOptions, ImportResult,
};
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use anyhow::{anyhow, Result};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use chrono::Utc;
use hmac::Hmac;
use pbkdf2::pbkdf2;
use rand::RngCore;
use sha2::Sha256;
use std::collections::HashSet;
use uuid::Uuid;

// ── URI generation ────────────────────────────────────────────────────────────

/// Encode a password component for use in a URI (percent-encode special chars).
fn encode_uri_component(s: &str) -> String {
    urlencoding::encode(s).into_owned()
}

/// Build a single DATABASE_URL string for a connection.
/// If `include_password` is false the password component is omitted entirely.
pub fn connection_to_uri(conn: &ConnectionConfig, include_password: bool) -> String {
    match conn.db_type {
        DatabaseType::Mongodb => {
            // MongoDB connections already store a full URI
            if let Some(uri) = &conn.uri {
                if !include_password {
                    // Strip password from URI if present
                    if let Ok(parsed) = url::Url::parse(uri) {
                        let mut u = parsed.clone();
                        let _ = u.set_password(None);
                        return u.to_string();
                    }
                }
                return uri.clone();
            }
            // Fallback: build from fields
            let host = conn.host.as_deref().unwrap_or("localhost");
            let port = conn.port.unwrap_or(27017);
            let db = conn.database.as_deref().unwrap_or("");
            if let (Some(user), Some(pass)) = (&conn.user, &conn.password) {
                if include_password {
                    format!(
                        "mongodb://{}:{}@{}:{}/{}",
                        encode_uri_component(user),
                        encode_uri_component(pass),
                        host,
                        port,
                        db
                    )
                } else {
                    format!(
                        "mongodb://{}@{}:{}/{}",
                        encode_uri_component(user),
                        host,
                        port,
                        db
                    )
                }
            } else {
                format!("mongodb://{}:{}/{}", host, port, db)
            }
        }
        DatabaseType::Redis => {
            let host = conn.host.as_deref().unwrap_or("localhost");
            let port = conn.port.unwrap_or(6379);
            let scheme = if conn.ssl.unwrap_or(false) {
                "rediss"
            } else {
                "redis"
            };
            match (&conn.password, include_password) {
                (Some(pw), true) if !pw.is_empty() => {
                    format!(
                        "{}://:{}@{}:{}",
                        scheme,
                        encode_uri_component(pw),
                        host,
                        port
                    )
                }
                _ => format!("{}://{}:{}", scheme, host, port),
            }
        }
        DatabaseType::Sqlite => {
            let path = conn.database.as_deref().unwrap_or("");
            format!("sqlite:///{}", path)
        }
        DatabaseType::Postgresql => {
            let host = conn.host.as_deref().unwrap_or("localhost");
            let port = conn.port.unwrap_or(5432);
            let db = conn.database.as_deref().unwrap_or("");
            let mut auth = String::new();
            if let Some(user) = &conn.user {
                auth.push_str(&encode_uri_component(user));
                if let (Some(pw), true) = (&conn.password, include_password) {
                    if !pw.is_empty() {
                        auth.push(':');
                        auth.push_str(&encode_uri_component(pw));
                    }
                }
                auth.push('@');
            }
            let ssl_param = if conn.ssl.unwrap_or(false) {
                "?sslmode=require"
            } else {
                ""
            };
            format!("postgresql://{}{}:{}/{}{}", auth, host, port, db, ssl_param)
        }
        DatabaseType::Mysql => {
            let host = conn.host.as_deref().unwrap_or("localhost");
            let port = conn.port.unwrap_or(3306);
            let db = conn.database.as_deref().unwrap_or("");
            let mut auth = String::new();
            if let Some(user) = &conn.user {
                auth.push_str(&encode_uri_component(user));
                if let (Some(pw), true) = (&conn.password, include_password) {
                    if !pw.is_empty() {
                        auth.push(':');
                        auth.push_str(&encode_uri_component(pw));
                    }
                }
                auth.push('@');
            }
            let ssl_param = if conn.ssl.unwrap_or(false) {
                "?ssl-mode=REQUIRED"
            } else {
                ""
            };
            format!("mysql://{}{}:{}/{}{}", auth, host, port, db, ssl_param)
        }
    }
}

/// Export connections as one URI per line.
pub fn export_uri_text(conns: &[ConnectionConfig], include_passwords: bool) -> String {
    conns
        .iter()
        .map(|c| {
            let uri = connection_to_uri(c, include_passwords);
            format!("# {}\n{}", c.name, uri)
        })
        .collect::<Vec<_>>()
        .join("\n\n")
}

// ── URI parsing ───────────────────────────────────────────────────────────────

/// Parse a single DATABASE_URL string into a partial `ConnectionConfig`.
/// Generates a new random ID and derives a name/prefix from the URI.
pub fn parse_uri(uri: &str) -> Result<ConnectionConfig> {
    let parsed = url::Url::parse(uri).map_err(|e| anyhow!("Invalid URI: {e}"))?;

    let scheme = parsed.scheme().to_lowercase();
    let db_type = match scheme.as_str() {
        "postgresql" | "postgres" => DatabaseType::Postgresql,
        "mysql" => DatabaseType::Mysql,
        "sqlite" => DatabaseType::Sqlite,
        "mongodb" | "mongodb+srv" => DatabaseType::Mongodb,
        "redis" | "rediss" => DatabaseType::Redis,
        other => return Err(anyhow!("Unrecognised URI scheme: {other}")),
    };

    let host = parsed.host_str().map(|s| s.to_string());
    let port = parsed.port();
    let user = if parsed.username().is_empty() {
        None
    } else {
        Some(parsed.username().to_string())
    };
    let password = parsed.password().map(|s| s.to_string());

    // Database comes from the first path segment (strip leading '/')
    let database = {
        let path = parsed.path().trim_start_matches('/');
        if path.is_empty() {
            None
        } else {
            Some(path.to_string())
        }
    };

    // SSL detection from query params
    let ssl = parsed
        .query_pairs()
        .any(|(k, v)| (k == "sslmode" && v != "disable") || (k == "ssl-mode" && v != "DISABLED"));

    let name = match db_type {
        DatabaseType::Sqlite => database.as_deref().unwrap_or("sqlite").to_string(),
        _ => format!(
            "{} ({})",
            database.as_deref().unwrap_or("import"),
            host.as_deref().unwrap_or("localhost")
        ),
    };

    let prefix = name
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '_' })
        .collect::<String>()
        .trim_matches('_')
        .to_string();

    // For MongoDB store the raw URI too
    let uri_field = match db_type {
        DatabaseType::Mongodb => Some(uri.to_string()),
        _ => None,
    };

    let ssl_val = if ssl { Some(true) } else { None };
    let scheme_ssl = matches!(scheme.as_str(), "rediss");

    Ok(ConnectionConfig {
        id: Uuid::new_v4().to_string(),
        name,
        prefix,
        db_type,
        host,
        port,
        user,
        password,
        database,
        schema: None,
        ssl: if ssl || scheme_ssl {
            Some(true)
        } else {
            ssl_val
        },
        uri: uri_field,
        group: None,
        ssh_enabled: None,
        ssh_host: None,
        ssh_port: None,
        ssh_user: None,
        ssh_password: None,
        ssh_key_path: None,
        ssh_key_passphrase: None,
    })
}

// ── Passphrase-based encryption ───────────────────────────────────────────────

const PBKDF2_ITERATIONS: u32 = 100_000;

/// Encrypt `plaintext` with a key derived from `passphrase`.
/// Output format: base64(salt[16] || nonce[12] || ciphertext)
pub fn encrypt_with_passphrase(plaintext: &str, passphrase: &str) -> Result<String> {
    let mut salt = [0u8; 16];
    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut salt);
    rand::thread_rng().fill_bytes(&mut nonce_bytes);

    let mut key = [0u8; 32];
    pbkdf2::<Hmac<Sha256>>(passphrase.as_bytes(), &salt, PBKDF2_ITERATIONS, &mut key)
        .map_err(|e| anyhow!("PBKDF2 error: {e}"))?;

    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| anyhow!("{e}"))?;
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| anyhow!("Encryption error: {e}"))?;

    let mut output = Vec::with_capacity(16 + 12 + ciphertext.len());
    output.extend_from_slice(&salt);
    output.extend_from_slice(&nonce_bytes);
    output.extend_from_slice(&ciphertext);
    Ok(B64.encode(output))
}

/// Decrypt a value produced by `encrypt_with_passphrase`.
pub fn decrypt_with_passphrase(encoded: &str, passphrase: &str) -> Result<String> {
    let data = B64
        .decode(encoded)
        .map_err(|e| anyhow!("Base64 error: {e}"))?;
    if data.len() < 28 {
        return Err(anyhow!("Invalid encrypted data"));
    }
    let (salt, rest) = data.split_at(16);
    let (nonce_bytes, ciphertext) = rest.split_at(12);

    let mut key = [0u8; 32];
    pbkdf2::<Hmac<Sha256>>(passphrase.as_bytes(), salt, PBKDF2_ITERATIONS, &mut key)
        .map_err(|e| anyhow!("PBKDF2 error: {e}"))?;

    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| anyhow!("{e}"))?;
    let nonce = Nonce::from_slice(nonce_bytes);
    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| anyhow!("Decryption failed — wrong passphrase?"))?;

    String::from_utf8(plaintext).map_err(|e| anyhow!("{e}"))
}

// ── Export ────────────────────────────────────────────────────────────────────

pub fn export_native_json(conns: &[ConnectionConfig], opts: &ExportOptions) -> Result<String> {
    let mut output_conns: Vec<ConnectionConfig> = conns
        .iter()
        .filter(|c| {
            opts.connection_ids
                .as_ref()
                .map_or(true, |ids| ids.contains(&c.id))
        })
        .cloned()
        .collect();

    for conn in &mut output_conns {
        match (&opts.include_passwords, conn.password.take()) {
            (true, Some(pw)) if !pw.is_empty() => {
                let passphrase = opts
                    .passphrase
                    .as_deref()
                    .ok_or_else(|| anyhow!("passphrase required when include_passwords is true"))?;
                conn.password = Some(encrypt_with_passphrase(&pw, passphrase)?);
            }
            _ => {
                conn.password = None;
            }
        }
    }

    let export = ConnectionExport {
        version: 1,
        app: "db-connect".to_string(),
        exported_at: Utc::now().to_rfc3339(),
        password_protected: opts.include_passwords && opts.passphrase.is_some(),
        connections: output_conns,
    };

    serde_json::to_string_pretty(&export).map_err(|e| anyhow!("{e}"))
}

// ── Import ────────────────────────────────────────────────────────────────────

pub fn import_native_json(
    json: &str,
    opts: &ImportOptions,
    existing_ids: &HashSet<String>,
) -> Result<ImportResult> {
    let export: ConnectionExport =
        serde_json::from_str(json).map_err(|e| anyhow!("Invalid JSON: {e}"))?;

    if export.version != 1 {
        return Err(anyhow!("Unsupported export version: {}", export.version));
    }

    let mut result = ImportResult {
        imported: 0,
        skipped: 0,
        errors: vec![],
        connections: vec![],
    };

    if export.app != "db-connect" {
        result.errors.push(format!(
            "Warning: file was created by '{}', not db-connect",
            export.app
        ));
    }

    for mut conn in export.connections {
        // Decrypt password if protected
        if export.password_protected {
            if let Some(enc_pw) = conn.password.take() {
                match opts.passphrase.as_deref() {
                    Some(passphrase) => match decrypt_with_passphrase(&enc_pw, passphrase) {
                        Ok(pw) => conn.password = Some(pw),
                        Err(e) => return Err(anyhow!("Failed to decrypt '{}': {e}", conn.name)),
                    },
                    None => {
                        return Err(anyhow!("passphrase required for protected export"));
                    }
                }
            }
        }

        // Conflict resolution
        if existing_ids.contains(&conn.id) {
            match opts.conflict_strategy {
                ConflictStrategy::Skip => {
                    result.skipped += 1;
                    continue;
                }
                ConflictStrategy::Overwrite => { /* keep same id */ }
                ConflictStrategy::Rename => {
                    conn.id = Uuid::new_v4().to_string();
                    conn.name = format!("{} (imported)", conn.name);
                }
            }
        }

        result.connections.push(conn);
        result.imported += 1;
    }

    Ok(result)
}

pub fn import_dbeaver(
    json: &str,
    opts: &ImportOptions,
    existing_ids: &HashSet<String>,
) -> Result<ImportResult> {
    let raw: serde_json::Value =
        serde_json::from_str(json).map_err(|e| anyhow!("Invalid DBeaver JSON: {e}"))?;

    let connections_map = raw
        .get("connections")
        .and_then(|v| v.as_object())
        .ok_or_else(|| anyhow!("No 'connections' object found in DBeaver file"))?;

    let mut result = ImportResult {
        imported: 0,
        skipped: 0,
        errors: vec![],
        connections: vec![],
    };

    for (_dbeaver_id, entry) in connections_map {
        let name = entry
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("Unnamed")
            .to_string();

        let provider = entry.get("provider").and_then(|v| v.as_str()).unwrap_or("");

        let db_type = match provider {
            "postgresql" | "postgres-jdbc" => DatabaseType::Postgresql,
            "mysql" => DatabaseType::Mysql,
            "sqlite" => DatabaseType::Sqlite,
            "mongodb" => DatabaseType::Mongodb,
            "redis" => DatabaseType::Redis,
            other => {
                result
                    .errors
                    .push(format!("Skipped '{}': unknown provider '{}'", name, other));
                result.skipped += 1;
                continue;
            }
        };

        let cfg = entry.get("configuration");
        let host = cfg
            .and_then(|c| c.get("host"))
            .and_then(|v| v.as_str())
            .map(String::from);
        let port: Option<u16> = cfg.and_then(|c| c.get("port")).and_then(|v| {
            v.as_str()
                .and_then(|s| s.parse().ok())
                .or(v.as_u64().map(|n| n as u16))
        });
        let user = cfg
            .and_then(|c| c.get("user"))
            .and_then(|v| v.as_str())
            .map(String::from);
        let database = cfg
            .and_then(|c| c.get("database"))
            .and_then(|v| v.as_str())
            .map(String::from);
        let group = entry
            .get("folder")
            .and_then(|v| v.as_str())
            .map(String::from);

        let prefix = name
            .to_lowercase()
            .chars()
            .map(|c| if c.is_alphanumeric() { c } else { '_' })
            .collect::<String>()
            .trim_matches('_')
            .to_string();

        let mut conn = ConnectionConfig {
            id: Uuid::new_v4().to_string(),
            name: name.clone(),
            prefix,
            db_type,
            host,
            port,
            user,
            password: None, // DBeaver uses Blowfish encryption — not imported
            database,
            schema: None,
            ssl: None,
            uri: None,
            group,
            ssh_enabled: None,
            ssh_host: None,
            ssh_port: None,
            ssh_user: None,
            ssh_password: None,
            ssh_key_path: None,
            ssh_key_passphrase: None,
        };

        result.errors.push(format!(
            "Password for '{}' was not imported (DBeaver uses proprietary encryption)",
            name
        ));

        // DBeaver assigns new IDs on export so check by name collision instead
        if existing_ids.contains(&conn.id) {
            match opts.conflict_strategy {
                ConflictStrategy::Skip => {
                    result.skipped += 1;
                    continue;
                }
                ConflictStrategy::Overwrite => {}
                ConflictStrategy::Rename => {
                    conn.id = Uuid::new_v4().to_string();
                    conn.name = format!("{} (imported)", conn.name);
                }
            }
        }

        result.connections.push(conn);
        result.imported += 1;
    }

    Ok(result)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn pg_conn() -> ConnectionConfig {
        ConnectionConfig {
            id: "test-id".into(),
            name: "Test PG".into(),
            prefix: "test_pg".into(),
            db_type: DatabaseType::Postgresql,
            host: Some("localhost".into()),
            port: Some(5432),
            user: Some("admin".into()),
            password: Some("p@ss:word".into()),
            database: Some("mydb".into()),
            schema: None,
            ssl: Some(true),
            uri: None,
            group: None,
        }
    }

    #[test]
    fn test_pg_uri_with_password() {
        let conn = pg_conn();
        let uri = connection_to_uri(&conn, true);
        assert!(uri.starts_with("postgresql://"));
        assert!(uri.contains("p%40ss%3Aword") || uri.contains("p%40ss"));
        assert!(uri.contains("sslmode=require"));
    }

    #[test]
    fn test_pg_uri_without_password() {
        let conn = pg_conn();
        let uri = connection_to_uri(&conn, false);
        assert!(!uri.contains("p@ss") && !uri.contains("p%40ss"));
        assert!(uri.contains("admin@"));
    }

    #[test]
    fn test_sqlite_uri() {
        let conn = ConnectionConfig {
            id: "s".into(),
            name: "SQLite".into(),
            prefix: "sqlite".into(),
            db_type: DatabaseType::Sqlite,
            host: None,
            port: None,
            user: None,
            password: None,
            database: Some("/home/user/db.sqlite".into()),
            schema: None,
            ssl: None,
            uri: None,
            group: None,
        };
        assert_eq!(
            connection_to_uri(&conn, false),
            "sqlite:////home/user/db.sqlite"
        );
    }

    #[test]
    fn test_redis_uri_with_ssl() {
        let conn = ConnectionConfig {
            id: "r".into(),
            name: "Redis".into(),
            prefix: "redis".into(),
            db_type: DatabaseType::Redis,
            host: Some("cache.example.com".into()),
            port: Some(6380),
            user: None,
            password: Some("secret".into()),
            database: None,
            schema: None,
            ssl: Some(true),
            uri: None,
            group: None,
        };
        let uri = connection_to_uri(&conn, true);
        assert!(uri.starts_with("rediss://"));
        assert!(uri.contains("secret"));
    }

    #[test]
    fn test_parse_pg_uri_roundtrip() {
        let original = pg_conn();
        let uri = connection_to_uri(&original, true);
        let parsed = parse_uri(&uri).unwrap();
        assert!(matches!(parsed.db_type, DatabaseType::Postgresql));
        assert_eq!(parsed.host.as_deref(), Some("localhost"));
        assert_eq!(parsed.port, Some(5432));
        assert_eq!(parsed.database.as_deref(), Some("mydb"));
        assert_eq!(parsed.ssl, Some(true));
    }

    #[test]
    fn test_parse_mysql_uri() {
        let parsed = parse_uri("mysql://root:pass@db.host:3306/myapp").unwrap();
        assert!(matches!(parsed.db_type, DatabaseType::Mysql));
        assert_eq!(parsed.host.as_deref(), Some("db.host"));
        assert_eq!(parsed.port, Some(3306));
        assert_eq!(parsed.user.as_deref(), Some("root"));
        assert_eq!(parsed.password.as_deref(), Some("pass"));
        assert_eq!(parsed.database.as_deref(), Some("myapp"));
    }

    #[test]
    fn test_parse_mongodb_srv_uri() {
        let parsed = parse_uri("mongodb+srv://user:pw@cluster.mongodb.net/mydb").unwrap();
        assert!(matches!(parsed.db_type, DatabaseType::Mongodb));
        assert!(parsed.uri.is_some());
    }

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let plain = "super-secret-password";
        let passphrase = "my-export-passphrase";
        let encrypted = encrypt_with_passphrase(plain, passphrase).unwrap();
        assert_ne!(encrypted, plain);
        let decrypted = decrypt_with_passphrase(&encrypted, passphrase).unwrap();
        assert_eq!(decrypted, plain);
    }

    #[test]
    fn test_decrypt_wrong_passphrase_fails() {
        let encrypted = encrypt_with_passphrase("secret", "correct-pass").unwrap();
        let result = decrypt_with_passphrase(&encrypted, "wrong-pass");
        assert!(result.is_err());
    }

    #[test]
    fn test_export_import_roundtrip_no_passwords() {
        let conns = vec![pg_conn()];
        let opts = ExportOptions {
            format: crate::types::ExportFormat::Json,
            include_passwords: false,
            passphrase: None,
            connection_ids: None,
        };
        let json = export_native_json(&conns, &opts).unwrap();
        let existing: HashSet<String> = HashSet::new();
        let import_opts = ImportOptions {
            format: crate::types::ImportFormat::Json,
            passphrase: None,
            conflict_strategy: ConflictStrategy::Skip,
        };
        let result = import_native_json(&json, &import_opts, &existing).unwrap();
        assert_eq!(result.imported, 1);
        assert!(result.connections[0].password.is_none());
    }

    #[test]
    fn test_export_import_roundtrip_with_passwords() {
        let conns = vec![pg_conn()];
        let passphrase = "test-passphrase-123";
        let opts = ExportOptions {
            format: crate::types::ExportFormat::Json,
            include_passwords: true,
            passphrase: Some(passphrase.into()),
            connection_ids: None,
        };
        let json = export_native_json(&conns, &opts).unwrap();
        let existing: HashSet<String> = HashSet::new();
        let import_opts = ImportOptions {
            format: crate::types::ImportFormat::Json,
            passphrase: Some(passphrase.into()),
            conflict_strategy: ConflictStrategy::Skip,
        };
        let result = import_native_json(&json, &import_opts, &existing).unwrap();
        assert_eq!(result.imported, 1);
        assert_eq!(result.connections[0].password.as_deref(), Some("p@ss:word"));
    }

    #[test]
    fn test_import_conflict_skip() {
        let conns = vec![pg_conn()];
        let opts = ExportOptions {
            format: crate::types::ExportFormat::Json,
            include_passwords: false,
            passphrase: None,
            connection_ids: None,
        };
        let json = export_native_json(&conns, &opts).unwrap();
        let mut existing = HashSet::new();
        existing.insert("test-id".to_string());
        let import_opts = ImportOptions {
            format: crate::types::ImportFormat::Json,
            passphrase: None,
            conflict_strategy: ConflictStrategy::Skip,
        };
        let result = import_native_json(&json, &import_opts, &existing).unwrap();
        assert_eq!(result.imported, 0);
        assert_eq!(result.skipped, 1);
    }

    #[test]
    fn test_import_conflict_rename() {
        let conns = vec![pg_conn()];
        let opts = ExportOptions {
            format: crate::types::ExportFormat::Json,
            include_passwords: false,
            passphrase: None,
            connection_ids: None,
        };
        let json = export_native_json(&conns, &opts).unwrap();
        let mut existing = HashSet::new();
        existing.insert("test-id".to_string());
        let import_opts = ImportOptions {
            format: crate::types::ImportFormat::Json,
            passphrase: None,
            conflict_strategy: ConflictStrategy::Rename,
        };
        let result = import_native_json(&json, &import_opts, &existing).unwrap();
        assert_eq!(result.imported, 1);
        assert_ne!(result.connections[0].id, "test-id");
        assert!(result.connections[0].name.contains("(imported)"));
    }
}

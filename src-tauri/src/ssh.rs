//! SSH tunnel — local port-forward through an SSH server.
//!
//! `SshTunnel::establish()` connects to the SSH server, authenticates,
//! binds a random local TCP port, and spawns a task that forwards every
//! incoming local connection to `(db_host, db_port)` through the SSH session.
//!
//! Drop (or call `.close()`) to abort the forwarding task.
//!
//! Host key verification uses Trust-on-First-Use (TOFU) via the standard
//! SSH known_hosts format. The known_hosts file lives in the app's data
//! directory to avoid polluting the user's regular SSH known_hosts.

use std::path::{Path, PathBuf};
use std::sync::Arc;

use anyhow::{anyhow, Result};
use russh::client;
use russh_keys::{check_known_hosts_path, learn_known_hosts_path, Error as RusshKeyError, key};
use tokio::io::copy_bidirectional;
use tokio::net::TcpListener;
use tokio::sync::Mutex;

// ── Handler ───────────────────────────────────────────────────────────────────

struct SshClientHandler {
    /// Path to the known_hosts file (within the app's data directory).
    known_hosts_path: PathBuf,
    host: String,
    port: u16,
}

impl SshClientHandler {
    fn new(known_hosts_path: PathBuf, host: String, port: u16) -> Self {
        Self { known_hosts_path, host, port }
    }
}

#[async_trait::async_trait]
impl client::Handler for SshClientHandler {
    type Error = anyhow::Error;

    async fn check_server_key(
        &mut self,
        server_public_key: &key::PublicKey,
    ) -> Result<bool, Self::Error> {
        match check_known_hosts_path(&self.host, self.port, server_public_key, &self.known_hosts_path) {
            Ok(true) => {
                // Key matches a known entry — accept
                Ok(true)
            }
            Ok(false) => {
                // Unknown host — Trust-on-First-Use: add to known_hosts
                let fingerprint = server_public_key.fingerprint();
                learn_known_hosts_path(&self.host, self.port, server_public_key, &self.known_hosts_path)
                    .map_err(|e| anyhow!("Failed to save known_hosts: {e}"))?;

                println!(
                    "[SSH] New host added to known_hosts: {}:{} (fingerprint: {})",
                    self.host, self.port, fingerprint
                );
                Ok(true)
            }
            Err(RusshKeyError::KeyChanged { line }) => {
                // Key mismatch — possible MITM attack
                let actual_fp = server_public_key.fingerprint();
                Err(anyhow!(
                    "Host key mismatch for [{}]:{} (known_hosts line {}) — possible man-in-the-middle attack!\n\
                     Actual fingerprint: {}\n\
                     If the server was reinstalled, remove that line from:\n  {}",
                    self.host, self.port, line, actual_fp, self.known_hosts_path.display()
                ))
            }
            Err(e) => Err(anyhow!("Known hosts check failed: {e}")),
        }
    }
}

// ── Auth ───────────────────────────────────────────────────────────────────────

pub enum SshAuth {
    Password(String),
    Key {
        path: String,
        passphrase: Option<String>,
    },
}

// ── Tunnel ─────────────────────────────────────────────────────────────────────

fn expand_tilde_path(path: &str) -> PathBuf {
    if path == "~" {
        return dirs::home_dir().unwrap_or_else(|| PathBuf::from(path));
    }

    if let Some(rest) = path.strip_prefix("~/") {
        if let Some(home) = dirs::home_dir() {
            return home.join(rest);
        }
    }

    Path::new(path).to_path_buf()
}

pub struct SshTunnel {
    pub local_port: u16,
    task: tokio::task::JoinHandle<()>,
}

impl SshTunnel {
    /// Establish an SSH tunnel.
    ///
    /// `known_hosts_path` defaults to `{app_data_dir}/known_hosts` if `None`.
    pub async fn establish(
        ssh_host: &str,
        ssh_port: u16,
        ssh_user: &str,
        auth: SshAuth,
        db_host: String,
        db_port: u16,
        known_hosts_path: Option<PathBuf>,
    ) -> Result<Self> {
        let config = Arc::new(client::Config::default());

        // Default known_hosts path: {app_data_dir}/ssh/known_hosts
        let kh_path = known_hosts_path.unwrap_or_else(|| {
            dirs::data_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join("ssh")
                .join("known_hosts")
        });
        if let Some(parent) = kh_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| anyhow!("Failed to create SSH known_hosts directory: {e}"))?;
        }

        let handler = SshClientHandler::new(kh_path, ssh_host.to_string(), ssh_port);

        let mut session = client::connect(config, (ssh_host, ssh_port), handler).await?;

        let authenticated = match auth {
            SshAuth::Password(pw) => session.authenticate_password(ssh_user, pw).await?,
            SshAuth::Key { path, passphrase } => {
                let key_path = expand_tilde_path(&path);
                let key_pair = russh_keys::load_secret_key(&key_path, passphrase.as_deref())?;
                session
                    .authenticate_publickey(ssh_user, Arc::new(key_pair))
                    .await?
            }
        };

        if !authenticated {
            return Err(anyhow!("SSH authentication failed"));
        }

        // Bind random local port
        let listener = TcpListener::bind("127.0.0.1:0").await?;
        let local_port = listener.local_addr()?.port();

        let preflight_channel = session
            .channel_open_direct_tcpip(&db_host, db_port as u32, "127.0.0.1", local_port as u32)
            .await
            .map_err(|e| {
                anyhow!(
                    "SSH server could not open a tunnel to database target {}:{}: {}. \
                     Check that the database host and port are reachable from the SSH server. \
                     If this host is a Docker service name like 'postgres', it only works when the SSH server is inside the same Docker network; otherwise use 127.0.0.1 with the published database port, or a private IP/DNS name reachable from the SSH server.",
                    db_host,
                    db_port,
                    e
                )
            })?;
        let _ = preflight_channel.close().await;

        let session = Arc::new(Mutex::new(session));

        let task = tokio::spawn(async move {
            while let Ok((mut local_stream, local_addr)) = listener.accept().await {
                let session = session.clone();
                let db_host = db_host.clone();

                tokio::spawn(async move {
                    let channel = {
                        let s = session.lock().await;
                        s.channel_open_direct_tcpip(
                            &db_host,
                            db_port as u32,
                            local_addr.ip().to_string(),
                            local_addr.port() as u32,
                        )
                            .await
                    };
                    match channel {
                        Ok(channel) => {
                            let mut stream = channel.into_stream();
                            if let Err(e) = copy_bidirectional(&mut local_stream, &mut stream).await
                            {
                                eprintln!("[SSH] I/O error: {e}");
                            }
                        }
                        Err(e) => eprintln!("[SSH] channel open failed: {e}"),
                    }
                });
            }
        });

        Ok(SshTunnel { local_port, task })
    }

    /// Abort the forwarding task and close the tunnel.
    pub fn close(self) {
        self.task.abort();
    }
}

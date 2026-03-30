//! SSH tunnel — local port-forward through an SSH server.
//!
//! `SshTunnel::establish()` connects to the SSH server, authenticates,
//! binds a random local TCP port, and spawns a task that forwards every
//! incoming local connection to `(db_host, db_port)` through the SSH session.
//!
//! Drop (or call `.close()`) to abort the forwarding task.

use std::sync::Arc;

use anyhow::{anyhow, Result};
use russh::client;
use russh_keys::key;
use tokio::io::copy_bidirectional;
use tokio::net::TcpListener;
use tokio::sync::Mutex;

// ── Handler ────────────────────────────────────────────────────────────────────

struct SshClientHandler;

#[async_trait::async_trait]
impl client::Handler for SshClientHandler {
    type Error = anyhow::Error;

    async fn check_server_key(
        &mut self,
        _server_public_key: &key::PublicKey,
    ) -> Result<bool, Self::Error> {
        // Accept all host keys — sufficient for typical internal tunnels.
        // TODO: verify against known_hosts for stricter security.
        Ok(true)
    }
}

// ── Auth ───────────────────────────────────────────────────────────────────────

pub enum SshAuth {
    Password(String),
    Key { path: String, passphrase: Option<String> },
}

// ── Tunnel ─────────────────────────────────────────────────────────────────────

pub struct SshTunnel {
    /// The local port that forwards to the remote database.
    pub local_port: u16,
    task: tokio::task::JoinHandle<()>,
}

impl SshTunnel {
    pub async fn establish(
        ssh_host: &str,
        ssh_port: u16,
        ssh_user: &str,
        auth: SshAuth,
        db_host: String,
        db_port: u16,
    ) -> Result<Self> {
        let config = Arc::new(client::Config::default());

        let mut session =
            client::connect(config, (ssh_host, ssh_port), SshClientHandler).await?;

        let authenticated = match auth {
            SshAuth::Password(pw) => session.authenticate_password(ssh_user, pw).await?,
            SshAuth::Key { path, passphrase } => {
                let key_pair = russh_keys::load_secret_key(&path, passphrase.as_deref())?;
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

        // Wrap session so the forwarding task and each connection task share it
        let session = Arc::new(Mutex::new(session));

        let task = tokio::spawn(async move {
            while let Ok((mut local_stream, _)) = listener.accept().await {
                let session = session.clone();
                let db_host = db_host.clone();

                tokio::spawn(async move {
                    let channel = {
                        let mut s = session.lock().await;
                        s.channel_open_direct_tcpip(
                            &db_host,
                            db_port as u32,
                            "127.0.0.1",
                            0,
                        )
                        .await
                    };
                    match channel {
                        Ok(channel) => {
                            let mut stream = channel.into_stream();
                            if let Err(e) =
                                copy_bidirectional(&mut local_stream, &mut stream).await
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

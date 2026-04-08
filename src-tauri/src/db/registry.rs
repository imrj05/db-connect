use crate::db::DatabaseDriver;
use crate::ssh::SshTunnel;
use crate::types::ConnectionConfig;
use dashmap::DashMap;
use once_cell::sync::Lazy;
use std::sync::Arc;

pub struct ConnectionRegistry {
    pub connections: DashMap<String, Arc<dyn DatabaseDriver>>,
    pub configs: DashMap<String, ConnectionConfig>,
    pub tunnels: DashMap<String, SshTunnel>,
}

impl ConnectionRegistry {
    pub fn new() -> Self {
        Self {
            connections: DashMap::new(),
            configs: DashMap::new(),
            tunnels: DashMap::new(),
        }
    }
}

pub static REGISTRY: Lazy<ConnectionRegistry> = Lazy::new(|| ConnectionRegistry::new());

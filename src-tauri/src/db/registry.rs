use dashmap::DashMap;
use crate::db::DatabaseDriver;
use crate::types::ConnectionConfig;
use std::sync::Arc;
use once_cell::sync::Lazy;

pub struct ConnectionRegistry {
    pub connections: DashMap<String, Arc<dyn DatabaseDriver>>,
    pub configs: DashMap<String, ConnectionConfig>,
}

impl ConnectionRegistry {
    pub fn new() -> Self {
        Self {
            connections: DashMap::new(),
            configs: DashMap::new(),
        }
    }
}

pub static REGISTRY: Lazy<ConnectionRegistry> = Lazy::new(|| ConnectionRegistry::new());

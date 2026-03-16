use dashmap::DashMap;
use crate::db::DatabaseDriver;
use std::sync::Arc;
use once_cell::sync::Lazy;

pub struct ConnectionRegistry {
    pub connections: DashMap<String, Arc<dyn DatabaseDriver>>,
}

impl ConnectionRegistry {
    pub fn new() -> Self {
        Self {
            connections: DashMap::new(),
        }
    }
}

pub static REGISTRY: Lazy<ConnectionRegistry> = Lazy::new(|| ConnectionRegistry::new());

use serde_json::Value;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

static ERROR_REPORTING_ENABLED: AtomicBool = AtomicBool::new(true);
static ANONYMOUS_TELEMETRY_ENABLED: AtomicBool = AtomicBool::new(false);

pub fn init() -> Option<sentry::ClientInitGuard> {
    let dsn = option_env!("GLITCHTIP_DSN")
        .or(option_env!("SENTRY_DSN"))
        .unwrap_or("")
        .trim();

    if dsn.is_empty() {
        return None;
    }

    let release = format!("db-connect@{}", env!("CARGO_PKG_VERSION"));
    let environment = if cfg!(debug_assertions) {
        "development"
    } else {
        "production"
    };

    Some(sentry::init((
        dsn,
        sentry::ClientOptions {
            release: Some(release.into()),
            environment: Some(environment.into()),
            send_default_pii: false,
            server_name: None,
            auto_session_tracking: false,
            traces_sample_rate: 0.0,
            before_send: Some(Arc::new(|mut event| {
                let is_telemetry = event
                    .tags
                    .get("telemetry")
                    .map(|value| value == "true")
                    .unwrap_or(false);

                if is_telemetry {
                    if !ANONYMOUS_TELEMETRY_ENABLED.load(Ordering::Relaxed) {
                        return None;
                    }
                } else if !ERROR_REPORTING_ENABLED.load(Ordering::Relaxed) {
                    return None;
                }

                event.user = None;
                event.request = None;
                event.server_name = None;
                Some(event)
            })),
            ..Default::default()
        },
    )))
}

#[tauri::command]
pub fn monitoring_set_preferences(
    error_reporting_enabled: bool,
    anonymous_telemetry_enabled: bool,
) {
    ERROR_REPORTING_ENABLED.store(error_reporting_enabled, Ordering::Relaxed);
    ANONYMOUS_TELEMETRY_ENABLED.store(anonymous_telemetry_enabled, Ordering::Relaxed);
}

#[tauri::command]
pub fn monitoring_capture_telemetry(name: String, properties: HashMap<String, String>) {
    if !ANONYMOUS_TELEMETRY_ENABLED.load(Ordering::Relaxed) || !is_safe_name(&name) {
        return;
    }

    let mut event = sentry::protocol::Event {
        level: sentry::Level::Info,
        message: Some(format!("telemetry.{name}")),
        ..Default::default()
    };

    event.tags.insert("telemetry".into(), "true".into());
    event.tags.insert("event".into(), name);
    event.tags.insert("surface".into(), "tauri".into());

    for (key, value) in properties.into_iter().take(20) {
        if is_safe_name(&key) {
            event.extra.insert(key, Value::String(truncate(value, 120)));
        }
    }

    sentry::capture_event(event);
}

fn is_safe_name(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-' | b'.'))
}

fn truncate(value: String, max_len: usize) -> String {
    if value.len() <= max_len {
        return value;
    }

    value.chars().take(max_len).collect()
}

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::sync::OnceLock;

/// Defaults must match the React side (`src/lib/monitoring.ts` /
/// `src/store/useAppStore.ts`):
///   - error reporting: ON by default
///   - anonymous telemetry: OFF by default
static ERROR_REPORTING_ENABLED: AtomicBool = AtomicBool::new(true);
static ANONYMOUS_TELEMETRY_ENABLED: AtomicBool = AtomicBool::new(false);

/// Filesystem location of the persisted prefs file, set once at startup so
/// `monitoring_set_preferences` can write through to disk later.
static PREFS_PATH: OnceLock<PathBuf> = OnceLock::new();

const PREFS_FILE: &str = "monitoring-prefs.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
struct MonitoringPrefs {
    #[serde(default = "default_true")]
    error_reporting_enabled: bool,
    #[serde(default)]
    anonymous_telemetry_enabled: bool,
}

fn default_true() -> bool {
    true
}

impl Default for MonitoringPrefs {
    fn default() -> Self {
        Self {
            error_reporting_enabled: true,
            anonymous_telemetry_enabled: false,
        }
    }
}

/// Initialise Sentry with the persisted user preferences applied to the
/// runtime atomics *before* the panic hook is installed. This is what makes
/// pre-frontend crashes respect the user's choice.
///
/// `data_dir` should be the same path Tauri uses for `app_data_dir()` —
/// callers can pass the value resolved by `tauri::Manager::path()` once the
/// app handle is available, or `default_data_dir()` for the pre-app-handle
/// path (e.g. inside `pub fn run`).
pub fn init(data_dir: Option<PathBuf>) -> Option<sentry::ClientInitGuard> {
    // Step 1 — load persisted prefs and apply them to the atomics before
    // Sentry's panic hook starts capturing anything.
    if let Some(dir) = data_dir {
        let prefs_path = dir.join(PREFS_FILE);
        let prefs = load_prefs(&prefs_path);
        ERROR_REPORTING_ENABLED.store(prefs.error_reporting_enabled, Ordering::Relaxed);
        ANONYMOUS_TELEMETRY_ENABLED.store(prefs.anonymous_telemetry_enabled, Ordering::Relaxed);
        let _ = PREFS_PATH.set(prefs_path);
    }

    // Step 2 — wire up Sentry (only if a DSN was baked in at compile time
    // by build.rs).
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

/// Best-effort guess at the path Tauri's `app_data_dir()` will resolve to.
/// Used at startup *before* the Tauri AppHandle exists, so that
/// `monitoring::init()` can read the persisted preference and apply it before
/// the panic hook is installed.
///
/// The directory layout follows Tauri 2's default for each OS, keyed off the
/// bundle identifier in `tauri.conf.json`. If we guess wrong (rare), the
/// worst-case is that we fall back to defaults until the frontend syncs.
pub fn default_data_dir(identifier: &str) -> Option<PathBuf> {
    #[cfg(target_os = "macos")]
    {
        // ~/Library/Application Support/{identifier}
        dirs::data_dir().map(|d| d.join(identifier))
    }
    #[cfg(target_os = "windows")]
    {
        // %APPDATA%/{identifier}
        dirs::data_dir().map(|d| d.join(identifier))
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        // $XDG_DATA_HOME/{identifier}  (typically ~/.local/share/{identifier})
        dirs::data_dir().map(|d| d.join(identifier))
    }
}

#[tauri::command]
pub fn monitoring_set_preferences(
    error_reporting_enabled: bool,
    anonymous_telemetry_enabled: bool,
) {
    ERROR_REPORTING_ENABLED.store(error_reporting_enabled, Ordering::Relaxed);
    ANONYMOUS_TELEMETRY_ENABLED.store(anonymous_telemetry_enabled, Ordering::Relaxed);

    // Persist so the next launch picks up the new value before init() runs.
    if let Some(path) = PREFS_PATH.get() {
        let prefs = MonitoringPrefs {
            error_reporting_enabled,
            anonymous_telemetry_enabled,
        };
        let _ = save_prefs(path, &prefs);
    }
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

fn load_prefs(path: &Path) -> MonitoringPrefs {
    match std::fs::read_to_string(path) {
        Ok(contents) => serde_json::from_str(&contents).unwrap_or_default(),
        Err(_) => MonitoringPrefs::default(),
    }
}

fn save_prefs(path: &Path, prefs: &MonitoringPrefs) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let json = serde_json::to_string_pretty(prefs)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;
    std::fs::write(path, json)
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

use std::path::Path;

fn main() {
    // Forward telemetry DSNs from the build environment (or a workspace `.env`
    // file) into the compiled binary so `option_env!("GLITCHTIP_DSN")` in
    // src/monitoring.rs picks them up. Vite handles the renderer side
    // separately via VITE_*-prefixed vars.
    forward_dsn_envs();

    tauri_build::build()
}

fn forward_dsn_envs() {
    // 1. Try to load `../.env` (the workspace root, next to package.json).
    //    We deliberately parse it ourselves — pulling in a dotenv crate just
    //    for two lookups would bloat the build dependency graph.
    let workspace_env = Path::new("..").join(".env");
    println!("cargo:rerun-if-changed={}", workspace_env.display());

    if let Ok(contents) = std::fs::read_to_string(&workspace_env) {
        for line in contents.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            if let Some((key, value)) = line.split_once('=') {
                let key = key.trim();
                if matches!(key, "GLITCHTIP_DSN" | "SENTRY_DSN") {
                    // Don't overwrite an env that the caller already set —
                    // an explicit `GLITCHTIP_DSN=… cargo build` should win.
                    if std::env::var_os(key).is_none() {
                        // Strip surrounding quotes, if any.
                        let value = value.trim().trim_matches(|c| c == '"' || c == '\'');
                        // Make it visible to option_env!() at compile time.
                        println!("cargo:rustc-env={key}={value}");
                    }
                }
            }
        }
    }

    // 2. Also forward whatever is currently in the build environment, so CI
    //    can inject the DSN without touching `.env`.
    for key in ["GLITCHTIP_DSN", "SENTRY_DSN"] {
        println!("cargo:rerun-if-env-changed={key}");
        if let Ok(value) = std::env::var(key) {
            println!("cargo:rustc-env={key}={value}");
        }
    }
}

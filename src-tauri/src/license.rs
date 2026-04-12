//! License verification and local storage.
//!
//! Provides ECDSA-P256 signature verification, local license state persistence,
//! and stable device ID management.
//!
//! The public key is embedded at compile time from `keys/license_public.pem`.
//! License state is stored in `{app_data_dir}/license-state.json`.
//! Device ID is stored in `{app_data_dir}/device-id.txt` (UUID generated on first run).

use anyhow::{anyhow, Result};
use base64::{engine::general_purpose::STANDARD, Engine};
use chrono::Utc;
use p256::{
    ecdsa::{signature::Verifier, DerSignature, Signature, VerifyingKey},
    pkcs8::DecodePublicKey,
};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::OnceLock;

/// The embedded public key (ECDSA P-256) — included at compile time.
const LICENSE_PUBLIC_KEY_PEM: &str = include_str!("../../keys/license_public.pem");

static APP_DATA_DIR: OnceLock<PathBuf> = OnceLock::new();

/// Call once during Tauri setup before any commands are invoked.
pub fn init(data_dir: PathBuf) {
    let _ = APP_DATA_DIR.set(data_dir);
}

fn license_state_path() -> PathBuf {
    APP_DATA_DIR
        .get()
        .expect("license::init() not called")
        .join("license-state.json")
}

fn device_id_path() -> PathBuf {
    APP_DATA_DIR
        .get()
        .expect("license::init() not called")
        .join("device-id.txt")
}

// ── Types ──────────────────────────────────────────────────────────────────────

/// The signed fields returned by the server after issuing or activating a license.
/// Accepts both snake_case and camelCase field names so it works regardless of
/// whether the server sends `license_key` or `licenseKey`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignedLicense {
    #[serde(alias = "licenseKey")]
    pub license_key: String,
    pub email: String,
    pub plan: String,
    pub expiry: String,
    #[serde(alias = "maxDevices")]
    pub max_devices: u32,
    #[serde(alias = "issuedAt")]
    pub issued_at: String,
    pub signature: String,
}

/// Local activation binding — proves this device was previously activated.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LicenseActivation {
    pub device_id: String,
    pub activated: bool,
    pub activated_at: String,
    pub last_validated_at: Option<String>,
}

/// The full structure persisted to `license-state.json`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredLicenseState {
    pub license: SignedLicense,
    pub activation: LicenseActivation,
}

/// Result returned to the frontend for offline and activation checks.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OfflineCheckResult {
    pub ok: bool,
    pub plan: Option<String>,
    pub reason: Option<String>,
}

// ── Device ID ─────────────────────────────────────────────────────────────────

/// Returns the stable device UUID for this installation, creating it on first run.
pub async fn get_or_create_device_id() -> Result<String> {
    let path = device_id_path();
    if path.exists() {
        let id = tokio::fs::read_to_string(&path).await?;
        return Ok(id.trim().to_string());
    }
    let id = uuid::Uuid::new_v4().to_string();
    tokio::fs::write(&path, &id).await?;
    Ok(id)
}

// ── Storage ───────────────────────────────────────────────────────────────────

pub async fn load_state() -> Result<Option<StoredLicenseState>> {
    let path = license_state_path();
    if !path.exists() {
        return Ok(None);
    }
    let raw = tokio::fs::read_to_string(&path).await?;
    let state = serde_json::from_str(&raw)?;
    Ok(Some(state))
}

pub async fn save_state(state: &StoredLicenseState) -> Result<()> {
    let path = license_state_path();
    tokio::fs::write(&path, serde_json::to_string_pretty(state)?).await?;
    Ok(())
}

pub async fn clear_state() -> Result<()> {
    let path = license_state_path();
    if path.exists() {
        tokio::fs::remove_file(&path).await?;
    }
    Ok(())
}

// ── Canonical payload ─────────────────────────────────────────────────────────

/// Keys in insertion order (matches JS server that does
/// `JSON.stringify({ license_key, email, plan, expiry, max_devices, issued_at })`).
fn canonical_insertion_order(lic: &SignedLicense) -> String {
    let k = serde_json::to_string(&lic.license_key).unwrap_or_default();
    let e = serde_json::to_string(&lic.email).unwrap_or_default();
    let p = serde_json::to_string(&lic.plan).unwrap_or_default();
    let x = serde_json::to_string(&lic.expiry).unwrap_or_default();
    let i = serde_json::to_string(&lic.issued_at).unwrap_or_default();
    format!(
        "{{\"license_key\":{k},\"email\":{e},\"plan\":{p},\"expiry\":{x},\"max_devices\":{},\"issued_at\":{i}}}",
        lic.max_devices,
    )
}

/// Keys sorted alphabetically — the "canonical JSON" convention used by many
/// signing libraries: email → expiry → issued_at → license_key → max_devices → plan
fn canonical_alphabetical(lic: &SignedLicense) -> String {
    let k = serde_json::to_string(&lic.license_key).unwrap_or_default();
    let e = serde_json::to_string(&lic.email).unwrap_or_default();
    let p = serde_json::to_string(&lic.plan).unwrap_or_default();
    let x = serde_json::to_string(&lic.expiry).unwrap_or_default();
    let i = serde_json::to_string(&lic.issued_at).unwrap_or_default();
    format!(
        "{{\"email\":{e},\"expiry\":{x},\"issued_at\":{i},\"license_key\":{k},\"max_devices\":{},\"plan\":{p}}}",
        lic.max_devices,
    )
}

// ── Signature verification ─────────────────────────────────────────────────────

/// Try DER and P1363 formats for a single payload string.
fn try_verify(key: &VerifyingKey, payload: &str, sig_bytes: &[u8]) -> bool {
    // DER-encoded ECDSA (Node.js crypto.createSign default)
    if let Ok(sig) = DerSignature::try_from(sig_bytes) {
        if key.verify(payload.as_bytes(), &sig).is_ok() {
            return true;
        }
    }
    // Raw IEEE P1363 (r || s, 64 bytes — WebCrypto subtle.sign default)
    if sig_bytes.len() == 64 {
        if let Ok(sig) = Signature::try_from(sig_bytes) {
            if key.verify(payload.as_bytes(), &sig).is_ok() {
                return true;
            }
        }
    }
    false
}

/// Verify the ECDSA-P256 signature, trying 4 combinations:
///   insertion-order keys × DER
///   insertion-order keys × P1363
///   alphabetically-sorted keys × DER
///   alphabetically-sorted keys × P1363
///
/// If still failing, the error includes both canonical strings so you can
/// compare them with what the server actually signed.
fn verify_signature(lic: &SignedLicense) -> Result<()> {
    let sig_bytes = STANDARD
        .decode(&lic.signature)
        .map_err(|_| anyhow!("invalid_signature_encoding"))?;

    let key = VerifyingKey::from_public_key_pem(LICENSE_PUBLIC_KEY_PEM)
        .map_err(|_| anyhow!("invalid_public_key"))?;

    let insertion = canonical_insertion_order(lic);
    let alpha = canonical_alphabetical(lic);

    if try_verify(&key, &insertion, &sig_bytes) || try_verify(&key, &alpha, &sig_bytes) {
        return Ok(());
    }

    Err(anyhow!(
        "signature_mismatch\n  tried (insertion-order): {insertion}\n  tried (alphabetical):    {alpha}"
    ))
}

// ── Offline verification ───────────────────────────────────────────────────────

/// Full offline license check run at app startup.
///
/// Checks (in order):
/// 1. Stored license exists
/// 2. Device binding matches current device
/// 3. ECDSA signature is valid
/// 4. License is not expired
pub async fn verify_offline() -> OfflineCheckResult {
    let stored = match load_state().await {
        Ok(Some(s)) => s,
        Ok(None) => {
            return OfflineCheckResult {
                ok: false,
                plan: None,
                reason: Some("missing_license".to_string()),
            }
        }
        Err(_) => {
            return OfflineCheckResult {
                ok: false,
                plan: None,
                reason: Some("corrupt_license".to_string()),
            }
        }
    };

    let current_device_id = match get_or_create_device_id().await {
        Ok(id) => id,
        Err(_) => {
            return OfflineCheckResult {
                ok: false,
                plan: None,
                reason: Some("device_id_error".to_string()),
            }
        }
    };

    if !stored.activation.activated {
        return OfflineCheckResult {
            ok: false,
            plan: None,
            reason: Some("not_activated".to_string()),
        };
    }

    if stored.activation.device_id != current_device_id {
        return OfflineCheckResult {
            ok: false,
            plan: None,
            reason: Some("device_mismatch".to_string()),
        };
    }

    if let Err(e) = verify_signature(&stored.license) {
        return OfflineCheckResult {
            ok: false,
            plan: None,
            reason: Some(format!("invalid_signature: {e}")),
        };
    }

    match chrono::DateTime::parse_from_rfc3339(&stored.license.expiry) {
        Ok(expiry) if expiry < Utc::now() => {
            return OfflineCheckResult {
                ok: false,
                plan: None,
                reason: Some("expired".to_string()),
            }
        }
        Err(_) => {
            return OfflineCheckResult {
                ok: false,
                plan: None,
                reason: Some("invalid_expiry".to_string()),
            }
        }
        _ => {}
    }

    OfflineCheckResult {
        ok: true,
        plan: Some(stored.license.plan.clone()),
        reason: None,
    }
}

// ── Verify and store an activation response ────────────────────────────────────

/// Verify a signed license payload (returned by the activation server) and
/// persist it as the local license state for this device.
///
/// This is called from the frontend after it receives a successful activation
/// response from the server API.
pub async fn verify_and_store(license: SignedLicense) -> Result<OfflineCheckResult> {
    // 1. Verify ECDSA signature against the embedded public key
    verify_signature(&license).map_err(|e| anyhow!("Signature invalid: {e}"))?;

    // 2. Reject already-expired licenses
    let expiry = chrono::DateTime::parse_from_rfc3339(&license.expiry)
        .map_err(|_| anyhow!("Invalid expiry date in license"))?;
    if expiry < Utc::now() {
        return Err(anyhow!("License is already expired"));
    }

    // 3. Bind to current device
    let device_id = get_or_create_device_id().await?;
    let now = Utc::now().to_rfc3339();
    let plan = license.plan.clone();

    let state = StoredLicenseState {
        license,
        activation: LicenseActivation {
            device_id,
            activated: true,
            activated_at: now.clone(),
            last_validated_at: Some(now),
        },
    };

    save_state(&state).await?;

    Ok(OfflineCheckResult {
        ok: true,
        plan: Some(plan),
        reason: None,
    })
}

/// Update `last_validated_at` after a successful background online sync.
pub async fn update_last_validated() -> Result<()> {
    let mut state = load_state()
        .await?
        .ok_or_else(|| anyhow!("No license state to update"))?;
    state.activation.last_validated_at = Some(Utc::now().to_rfc3339());
    save_state(&state).await
}

import { invoke } from "@tauri-apps/api/core";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SignedLicense {
  license_key: string;
  email: string;
  plan: string;
  expiry: string;
  max_devices: number;
  issued_at: string;
  signature: string;
}

export interface LicenseActivation {
  device_id: string;
  activated: boolean;
  activated_at: string;
  last_validated_at: string | null;
}

export interface StoredLicenseState {
  license: SignedLicense;
  activation: LicenseActivation;
}

export interface OfflineCheckResult {
  ok: boolean;
  plan?: string;
  reason?: string;
}

// ── Tauri command wrappers ─────────────────────────────────────────────────────

/** Returns the stable device UUID for this installation. */
export async function licenseGetDeviceId(): Promise<string> {
  return invoke("license_get_device_id");
}

/** Returns the human-readable device name (macOS computer name, Windows COMPUTERNAME, etc.). */
export async function licenseGetDeviceName(): Promise<string> {
  return invoke("license_get_device_name");
}

/** Runs the full offline license check. Call on every app startup. */
export async function licenseCheckOffline(): Promise<OfflineCheckResult> {
  return invoke("license_check_offline");
}

/**
 * Verifies a signed license payload received from the activation server
 * and persists it to disk as the local license state.
 */
export async function licenseVerifyAndStore(
  // Accept both SignedLicense (snake_case) and raw server response (possibly camelCase)
  raw: SignedLicense | Record<string, unknown>
): Promise<OfflineCheckResult> {
  // Normalize to snake_case so Rust deserialization never fails on field name mismatches
  const licensePayload: SignedLicense = {
    license_key: (raw as any).license_key ?? (raw as any).licenseKey ?? "",
    email:        (raw as any).email ?? "",
    plan:         (raw as any).plan ?? "",
    expiry:       (raw as any).expiry ?? "",
    max_devices:  (raw as any).max_devices ?? (raw as any).maxDevices ?? 0,
    issued_at:    (raw as any).issued_at ?? (raw as any).issuedAt ?? "",
    signature:    (raw as any).signature ?? "",
  };
  return invoke("license_verify_and_store", { licensePayload });
}

/** Clears the stored license (deactivates this device). */
export async function licenseDeactivate(): Promise<void> {
  return invoke("license_deactivate");
}

/** Returns the full stored license state, or null if none. */
export async function licenseGetStored(): Promise<StoredLicenseState | null> {
  return invoke("license_get_stored");
}

/** Updates last_validated_at after a successful background online sync. */
export async function licenseUpdateValidated(): Promise<void> {
  return invoke("license_update_validated");
}

// ── Online activation helper ───────────────────────────────────────────────────

/**
 * Calls the server activation API, then verifies and stores the returned
 * signed license payload.
 *
 * The server URL is the base URL of your license backend
 * (e.g. "https://your-server.com").
 */
export async function activateLicenseOnline(params: {
  licenseKey: string;
  deviceName: string;
  serverUrl: string;
}): Promise<OfflineCheckResult> {
  const deviceId = await licenseGetDeviceId();

  const response = await fetch(`${params.serverUrl}/api/license/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      license_key: params.licenseKey,
      device_id: deviceId,
      device_name: params.deviceName,
    }),
  });

  if (!response.ok) {
    let message = `Server returned ${response.status}`;
    try {
      const body = await response.json();
      if (body?.message) message = body.message;
      else if (body?.error) message = body.error;
    } catch { /* ignore */ }
    throw new Error(message);
  }

  const body = await response.json();

  // The activation endpoint wraps the signed fields under a `license` key.
  // Fall back to treating the whole body as the license if no `license` key exists.
  const signedLicense = (body?.license ?? body) as SignedLicense;
  return licenseVerifyAndStore(signedLicense);
}

/**
 * Background online validation — silently refreshes last_validated_at.
 * Never throws; errors are swallowed so they don't interrupt the app.
 */
export async function syncLicenseInBackground(serverUrl: string): Promise<void> {
  try {
    const stored = await licenseGetStored();
    if (!stored) return;

    const response = await fetch(
      `${serverUrl}/api/license/validate?key=${encodeURIComponent(stored.license.license_key)}`,
    ).catch(() => null);

    if (!response || !response.ok) return;

    const result = (await response.json()) as {
      valid: boolean;
      expiry?: string | null;
      plan?: string | null;
    };

    if (!result.valid) {
      // Server says license is no longer valid — clear local state
      await licenseDeactivate();
      return;
    }

    await licenseUpdateValidated();
  } catch {
    // Never let background sync errors surface to the user
  }
}

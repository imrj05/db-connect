# App License Activation
## Purpose
This document explains how DB Connect license activation works, how the desktop app validates a license without a login, and what happens when the app is offline.
## Core Model
DB Connect uses a signed license model.
- The server creates a license record in Appwrite.
- The server signs the license payload with the private key.
- The desktop app contains the public key.
- The desktop app verifies the license locally with the public key.
- The server is only needed for activation tracking, optional periodic checks, and revocation.
This means the app can unlock and run offline after the signed license payload has been stored locally.
## License Payload
The signed fields are:
```json
{
  "license_key": "DBK-XXXX-XXXX-XXXX-XXXX",
  "email": "user@example.com",
  "plan": "pro",
  "expiry": "2026-12-31T00:00:00.000Z",
  "max_devices": 3,
  "issued_at": "2026-04-12T10:00:00.000Z"
}
```
The server signs the canonical version of this payload and stores the resulting `signature` with the license.
The Appwrite license document also stores operational fields such as:
- `userId`
- `planId`
- `planName`
- `status`
- `price`
- `isRevoked`
The offline verifier only needs the signed license fields plus `signature`.
## Issuance Flow
License issuance happens in the payment success paths:
- [app/api/subscription/verify/route.ts](app/api/subscription/verify/route.ts)
- [app/api/subscription/webhook/route.ts](app/api/subscription/webhook/route.ts)
- [lib/license/sign.ts](lib/license/sign.ts)
Server flow:
1. Payment is verified.
2. The user and plan are resolved.
3. A new license key is generated.
4. The server builds a signed license payload.
5. The payload is signed using `LICENSE_PRIVATE_KEY`.
6. The full license document is stored in Appwrite.
## First Activation
First activation is online and device-bound.
Endpoint:
- [app/api/license/activate/route.ts](app/api/license/activate/route.ts)
Request body:
```json
{
  "license_key": "DBK-XXXX-XXXX-XXXX-XXXX",
  "device_id": "macbook-pro-serial-123",
  "device_name": "Rajeshwar MacBook Pro"
}
```
Server checks:
1. Input format is validated.
2. Rate limiting is applied.
3. The license is loaded from Appwrite.
4. The signed payload is verified using the public key logic.
5. Expiry is checked.
6. Revocation is checked.
7. Existing activations for the license are counted.
8. Duplicate device activation is prevented.
9. A new activation record is stored if slots are available.
If activation succeeds, the desktop app should persist the signed license payload locally.
## What The Desktop App Stores
For offline startup, the desktop app should store:
1. The signed license payload.
2. The `signature`.
3. The local `device_id`.
4. The last successful online validation timestamp.
5. The last known activation status for the current device.
Recommended local structure:
```json
{
  "license": {
    "license_key": "DBK-XXXX-XXXX-XXXX-XXXX",
    "email": "user@example.com",
    "plan": "pro",
    "expiry": "2026-12-31T00:00:00.000Z",
    "max_devices": 3,
    "issued_at": "2026-04-12T10:00:00.000Z",
    "signature": "BASE64_SIGNATURE"
  },
  "device_id": "macbook-pro-serial-123",
  "activated": true,
  "last_validated_at": "2026-04-12T10:05:00.000Z"
}
```
## Offline Startup Flow
Offline startup does not call the server.
The app should do this on launch:
1. Load the locally stored signed license.
2. Run the same signature verification logic as the server.
3. Reject the license if the signature is invalid.
4. Reject the license if the expiry has passed.
5. Reject the license if the local activation state is missing for the current device.
6. Unlock features if the license verifies successfully.
The verification logic lives in:
- [lib/license/verify.ts](lib/license/verify.ts)
That verifier checks:
- payload shape
- signature integrity
- expiry
- revocation flag if present in the local payload
Because the app is offline, revocation can only be enforced from the last synced state. A license revoked on the server will only be blocked after the app goes online and refreshes its status.
## Local Verifier
The local verifier is the part of the desktop app that decides whether a stored license is still trusted when the app starts without network access.
Its job is not to talk to Appwrite.
Its job is to prove three things locally:
1. the license payload was issued by your server
2. the payload was not modified after issuance
3. the license is still within its allowed usage window
### What The Local Verifier Needs
The desktop app must ship or bundle:
- the public key
- the verification algorithm name
- the exact payload fields that were originally signed
- the verifier implementation
The desktop app must persist locally:
- `license_key`
- `email`
- `plan`
- `expiry`
- `max_devices`
- `issued_at`
- `signature`
- `device_id`
- local activation state for the current machine
- last successful online sync timestamp
Without these values, the app cannot safely decide whether offline unlock is allowed.
### What The Local Verifier Must Not Need
The local verifier must never require:
- the private key
- an Appwrite session
- a user login
- a live API request on every startup
If any of those are required, the app is no longer truly offline-capable.
### Verification Steps Inside The App
When the desktop app starts offline, the local verifier should run this sequence:
1. Load the stored license object from disk.
2. Check that all required fields exist.
3. Rebuild the canonical signed payload in the same shape used by the server.
4. Verify the signature using the bundled public key.
5. Reject the license if the signature fails.
6. Parse and evaluate the expiry date.
7. Reject the license if it is expired.
8. Check that the stored device activation state matches the current local `device_id`.
9. Unlock the app only if all checks pass.
### Canonical Payload Requirement
This part is critical.
The local verifier must reconstruct the exact same logical payload that the server signed. In DB Connect, that signed payload is:
```json
{
  "license_key": "DBK-XXXX-XXXX-XXXX-XXXX",
  "email": "user@example.com",
  "plan": "pro",
  "expiry": "2026-12-31T00:00:00.000Z",
  "max_devices": 3,
  "issued_at": "2026-04-12T10:00:00.000Z"
}
```
If the desktop app renames fields, changes ordering rules, trims values differently, or signs a different JSON shape, signature verification will fail.
That is why the local verifier should either:
- reuse the same verification utility logic as the server, or
- exactly mirror the payload normalization and canonical serialization rules from [lib/license/verify.ts](lib/license/verify.ts) and [lib/license/sign.ts](lib/license/sign.ts)
### What The Public Key Does
The public key lets the app confirm that the `signature` matches the stored license payload.
If a user edits any of these fields locally:
- `plan`
- `expiry`
- `max_devices`
- `email`
- `license_key`
- `issued_at`
the signature will stop matching and the local verifier must reject the license.
That is the reason offline verification is safe without embedding the private key.
### Device Check In Offline Mode
The signature proves the license is genuine, but it does not prove that the current machine is one of the activated devices.
That part is enforced by local activation state.
Recommended rule:
- after successful online activation, bind the stored license state to the current `device_id`
- on offline startup, compare the persisted `device_id` against the current device fingerprint or machine identifier
- if they do not match, require online activation again
This prevents a copied local license file from being trivially reused on another machine.
### Recommended Local Storage
The stored file should contain both the signed license and the local activation binding.
Example:
```json
{
  "license": {
    "license_key": "DBK-XXXX-XXXX-XXXX-XXXX",
    "email": "user@example.com",
    "plan": "pro",
    "expiry": "2026-12-31T00:00:00.000Z",
    "max_devices": 3,
    "issued_at": "2026-04-12T10:00:00.000Z",
    "signature": "BASE64_SIGNATURE"
  },
  "activation": {
    "device_id": "macbook-pro-serial-123",
    "activated": true,
    "activated_at": "2026-04-12T10:05:00.000Z",
    "last_validated_at": "2026-04-15T09:00:00.000Z"
  }
}
```
### Recommended Desktop App Decision Rules
Allow offline access only if:
- the stored license payload is complete
- the signature verifies successfully
- the license is not expired
- the local device binding matches the current machine
- the app is still inside any configured offline grace period for revocation sync
Deny offline access if:
- the signature is invalid
- the license file is incomplete
- the stored device binding does not match the current machine
- the license is expired
- the app has exceeded a required online revalidation window
### Optional Grace Period Rule
If you want stronger revocation enforcement, the local verifier can also check how long it has been since the last successful online validation.
Example policy:
- allow offline usage for up to 7 or 14 days after the last online validation
- after that, require the app to go online once before continuing
This is optional. Without it, offline mode is more permissive but revocation takes effect only after the app next reconnects.
### Practical Implementation Guidance
For the desktop app, the cleanest approach is:
1. keep the public key in app configuration
2. copy or port the verification logic from [lib/license/verify.ts](lib/license/verify.ts)
3. keep the signed payload untouched once stored locally
4. store the local activation state separately from the signed payload
5. run local verification on every app launch before unlocking premium features
The signed payload proves authenticity.
The local activation state proves that the current device previously activated successfully.
You need both for reliable offline licensing.
## Tauri Pseudocode Example
The following pseudocode shows one practical way to implement the offline license check in a Tauri desktop app.
It is not production code. It is meant to show the startup sequence and the separation between:
- online activation
- local persistence
- offline verification
### Data Model Stored Locally
```ts
type StoredLicenseState = {
  license: {
    license_key: string;
    email: string;
    plan: string;
    expiry: string;
    max_devices: number;
    issued_at: string;
    signature: string;
  };
  activation: {
    device_id: string;
    activated: boolean;
    activated_at: string;
    last_validated_at: string | null;
  };
};
```
### Public Key Configuration
```ts
const LICENSE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
...
-----END PUBLIC KEY-----`;
const LICENSE_ALGORITHM = "ECDSA-P256";
```
### Load Current Device ID
```ts
async function getCurrentDeviceId(): Promise<string> {
  // Example only.
  // Use a stable machine identifier strategy for your app.
  return await invoke("get_device_fingerprint");
}
```
### Read And Write Local License State
```ts
async function loadStoredLicense(): Promise<StoredLicenseState | null> {
  const raw = await readTextFile("license-state.json", {
    baseDir: BaseDirectory.AppConfig,
  }).catch(() => null);
  if (!raw) return null;
  return JSON.parse(raw) as StoredLicenseState;
}
async function saveStoredLicense(state: StoredLicenseState): Promise<void> {
  await writeTextFile("license-state.json", JSON.stringify(state, null, 2), {
    baseDir: BaseDirectory.AppConfig,
  });
}
```
### Local Offline Verifier
```ts
async function verifyStoredLicenseOffline(): Promise<
  | { ok: true; plan: string }
  | { ok: false; reason: string }
> {
  const stored = await loadStoredLicense();
  if (!stored) {
    return { ok: false, reason: "missing_license" };
  }
  const currentDeviceId = await getCurrentDeviceId();
  if (!stored.activation.activated) {
    return { ok: false, reason: "not_activated" };
  }
  if (stored.activation.device_id !== currentDeviceId) {
    return { ok: false, reason: "device_mismatch" };
  }
  const verification = await verifyLicense(stored.license, {
    publicKey: LICENSE_PUBLIC_KEY,
    algorithm: LICENSE_ALGORITHM,
  });
  if (!verification.valid) {
    return { ok: false, reason: verification.reason ?? "invalid_license" };
  }
  return {
    ok: true,
    plan: verification.plan ?? stored.license.plan,
  };
}
```
### First Online Activation
```ts
async function activateLicenseOnline(input: {
  licenseKey: string;
  deviceName: string;
}): Promise<void> {
  const deviceId = await getCurrentDeviceId();
  const activationResponse = await fetch("https://your-domain.com/api/license/activate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      license_key: input.licenseKey,
      device_id: deviceId,
      device_name: input.deviceName,
    }),
  });
  if (!activationResponse.ok) {
    throw new Error("Activation failed");
  }
  // You need the signed license payload locally.
  // This can come from your server response, from a follow-up fetch,
  // or from a license export/import flow.
  const signedLicense = await fetchSignedLicensePayloadSomehow();
  const verification = await verifyLicense(signedLicense, {
    publicKey: LICENSE_PUBLIC_KEY,
    algorithm: LICENSE_ALGORITHM,
  });
  if (!verification.valid) {
    throw new Error("Server returned an invalid signed license payload");
  }
  await saveStoredLicense({
    license: signedLicense,
    activation: {
      device_id: deviceId,
      activated: true,
      activated_at: new Date().toISOString(),
      last_validated_at: new Date().toISOString(),
    },
  });
}
```
### Startup Flow In Tauri
```ts
async function runAppStartup(): Promise<void> {
  const offlineCheck = await verifyStoredLicenseOffline();
  if (offlineCheck.ok) {
    unlockPremiumFeatures(offlineCheck.plan);
    startApplication();
    void syncLicenseInBackground();
    return;
  }
  showActivationScreen({
    reason: offlineCheck.reason,
  });
}
```
### Optional Background Online Validation
```ts
async function syncLicenseInBackground(): Promise<void> {
  const stored = await loadStoredLicense();
  if (!stored) return;
  const response = await fetch(
    `https://your-domain.com/api/license/validate?key=${encodeURIComponent(stored.license.license_key)}`,
  ).catch(() => null);
  if (!response || !response.ok) {
    return;
  }
  const result = await response.json() as {
    valid: boolean;
    expiry: string | null;
    plan: string | null;
  };
  if (!result.valid) {
    await invalidateLocalLicense("revoked_or_invalidated_online");
    forceRelogicToActivationScreen();
    return;
  }
  stored.activation.last_validated_at = new Date().toISOString();
  await saveStoredLicense(stored);
}
```
### Optional Offline Grace Period Check
```ts
function isWithinOfflineGracePeriod(lastValidatedAt: string | null): boolean {
  if (!lastValidatedAt) return false;
  const last = new Date(lastValidatedAt).getTime();
  const now = Date.now();
  const daysSinceLastValidation = (now - last) / 86_400_000;
  return daysSinceLastValidation <= 14;
}
```
You can apply that during offline startup:
```ts
if (!isWithinOfflineGracePeriod(stored.activation.last_validated_at)) {
  return { ok: false, reason: "revalidation_required" };
}
```
### Tauri Responsibilities Summary
In the Tauri app:
- activation is online
- license verification is local
- revocation sync is online when available
- feature unlock happens only after local signature verification passes
That is the pattern that keeps the app usable offline while still allowing controlled server-side revocation and activation tracking.
## Optional Online Validation
Endpoint:
- [app/api/license/validate/route.ts](app/api/license/validate/route.ts)
This endpoint is for periodic online checks.
The desktop app can call it:
- on startup when network is available
- once every few days
- before syncing premium features
- after a failed local activation state check
The endpoint returns:
- `valid`
- `expiry`
- `plan`
This should be treated as a sync signal, not as the primary unlock mechanism.
## Deactivation Flow
Endpoint:
- [app/api/license/deactivate/route.ts](app/api/license/deactivate/route.ts)
This frees a device slot on the server. It is not required for offline startup, but it is required if a user wants to move the license to another machine after all slots are used.
## Revocation Behavior
Revocation is stored on the server in Appwrite through `isRevoked`.
Behavior:
- Online activation must fail for revoked licenses.
- Online validation must fail for revoked licenses.
- Offline use continues only until the app next syncs and learns the license has been revoked.
If strict revocation enforcement is needed, the desktop app must require occasional online validation after a fixed grace period.
## Why Offline Works
Offline unlock works because the desktop app does not need the private key and does not need a logged-in user session.
It only needs:
- the signed license payload
- the public key
- the local verifier
The private key is only used on the server to create valid signatures. The public key is safe to ship with the app and is used to prove that the license payload came from your server and was not modified.
## Practical Rule
The server decides whether a license can be issued, activated, validated, revoked, or deactivated.
The desktop app decides whether a locally stored signed license is cryptographically valid and still within its expiry window.
That split is what allows DB Connect to run offline after successful activation.

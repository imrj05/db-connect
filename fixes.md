# Security & Code Quality Issues — Action Items

> Last updated: 2026-05-25
> Status: 6 of 16 issues fixed (critical/high priority items addressed)

## ✅ Completed Fixes

### 1. Hardcoded Encryption Key — FIXED
**File:** `src/lib/encryption.ts`
**Fix Applied:** Removed the hardcoded `DEFAULT_KEY`. The `encrypt` and `decrypt` functions now require an explicit key parameter. Callers must derive a key from user-provided secrets (e.g., password + salt). The `src/lib/storage.ts` was updated to use the new encryption interface.

---

### 2. SSH Host Key Verification — FIXED
**File:** `src-tauri/src/ssh.rs`
**Fix Applied:** Replaced the stub `check_server_key` (which always returned `Ok(true)`) with Trust-on-First-Use (TOFU) verification using `russh_keys::check_known_hosts_path` and `russh_keys::learn_known_hosts_path`. The known_hosts file lives at `{app_data_dir}/ssh/known_hosts`. Key changes trigger MITM warnings with detailed error messages pointing to the entry to remove.

---

### 3. SQL Injection in get_table_data — FIXED
**Files:** `src-tauri/src/db/postgres.rs`, `src-tauri/src/db/mysql.rs`, `src-tauri/src/db/sqlite.rs`
**Fix Applied:** Added `validate_sql_identifier()` and `validate_table_query_identifiers()` helpers in `src-tauri/src/db/mod.rs`. All `get_table_data`, `get_columns`, and `get_indexes` functions now validate identifiers before interpolation. SQLite's PRAGMA statements are also validated. Validation rejects identifiers containing quotes, null bytes, newlines, or semicolons.

---

### 6. Content Security Policy Disabled — FIXED
**File:** `src-tauri/tauri.conf.json`
**Fix Applied:** Replaced `"csp": null` with a restrictive CSP:
```json
"csp": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'"
```
Blocks external connections, iframes, and object embedding. Allows inline scripts/styles needed by UI frameworks.

---

### 7. No Input Validation on Connection Config — FIXED
**File:** `src-tauri/src/commands.rs`
**Fix Applied:** Added `validate_connection_config()` function that validates: connection ID (no path traversal chars), host (alphanumeric + dots/hyphens/underscores only), port (1-65535), database name (no SQL injection chars), SSH host/port/key_path. Validation is called at the start of `connect_database`.

---

### 10. Silent Error Handling in Import — FIXED
**File:** `src-tauri/src/commands.rs` (import_sql_file)
**Fix Applied:** Replaced the silent `let _ = driver.run_query(&create_sql).await;` with a `match` that logs the error via `eprintln!` when CREATE DATABASE fails. This preserves the non-fatal behavior (the subsequent reconnect still surfaces the real error) while making failures visible in logs for debugging.

---

## 🔴 CRITICAL — Fix Immediately

### 4. Legacy Key File Fallback Exposes Encryption Key
**File:** `src-tauri/src/storage.rs`
**Issue:** If keychain is unavailable, the encryption key falls back to `storage.key` stored as plaintext on disk.
**Fix:** Require keychain. Refuse to operate if keychain is unavailable. Do not store the key in a file. Alternatively, derive the key from a user-provided password.

---

### 5. No Query Complexity / Size Limits
**File:** `src-tauri/src/commands.rs`
**Issue:** `execute_query` accepts arbitrary SQL with no limits on query size, result set size, or execution time beyond a basic timeout.
**Fix:** Add limits: max query string length (e.g., 1MB), max rows returned (e.g., 10,000), and configurable statement timeout.

---

## 🟠 HIGH — Fix Soon

### 8. Credentials Held in Memory Without Zeroing
**Files:** All database drivers, `src-tauri/src/commands.rs`
**Issue:** Passwords stored in `ConnectionConfig` are not cleared from memory after use. Could persist in heap.
**Fix:** Use `zeroize` crate to clear sensitive fields after connection is established. Consider using `secrecy` crate for password handling.

---

### 9. SSH Key Passphrase Loaded Into Memory
**File:** `src-tauri/src/ssh.rs`
**Issue:** SSH key passphrase is held as `String` and passed to `russh_keys::load_secret_key`.
**Fix:** Use `secrecy::SecretString` to handle the passphrase.

---

## 🟡 MEDIUM — Plan Fix

### 11. No Rate Limiting / Throttling
**Files:** All command handlers in `src-tauri/src/commands.rs`
**Issue:** No limits on connection attempts, query frequency, or import operations.
**Fix:** Add rate limiting per connection ID. Use a simple token bucket or a request counter with a cooldown.

---

### 12. CSP Set to null Permits All External Connections
**File:** `src-tauri/tauri.conf.json`
**Note:** This was the same issue as #6 above (CSP was null). Now fixed with a restrictive policy (see #6).

---

## 🟢 LOW — Improve

### 13. Magic Numbers in Connection Pool Configuration
**Files:** `postgres.rs`, `mysql.rs`, `sqlite.rs`
**Issue:** `max_connections(5)` is hardcoded everywhere.
**Fix:** Move to configuration. Allow per-connection tuning.

---

### 14. Query Timeout Only 5 Seconds for Ping
**File:** `src-tauri/src/commands.rs` (connect_database)
**Issue:** The connection ping timeout is hardcoded at 5 seconds.
**Fix:** Make timeout configurable. Some databases on slow networks may need more time.

---

### 15. MongoDB SQL Parser Fragility
**File:** `src-tauri/src/db/mongodb.rs`
**Issue:** Custom SQL parser uses `to_ascii_uppercase()` and string searching. Fragile with edge cases like nested quotes or escaped characters.
**Fix:** Use a proper SQL parser library, or restrict to JSON-based queries only and remove the SQL emulation layer.

---

### 16. Error Messages Expose Internal Details
**File:** `src-tauri/src/license.rs`
**Issue:** Signature verification failures expose canonical JSON payloads in error messages.
**Fix:** Return generic errors to the frontend. Log detailed errors internally.

---

## ✅ Already Good — Maintain

- License verification uses ECDSA-P256 with proper signature validation
- Storage uses AES-256-GCM with proper nonce generation (12 bytes)
- Export encryption uses PBKDF2 with 100,000 iterations
- SQL dump parser has a comprehensive character-level state machine
- Most sqlx queries use parameterized queries (`.bind()`)
- SSH tunnel properly aborts tasks on close

---

## Priority Order (Updated)

1. ✅ **Remove hardcoded encryption key** (`src/lib/encryption.ts`)
2. ✅ **Implement SSH host key verification** (`ssh.rs`)
3. ✅ **Fix SQL injection in table data queries** (all driver files)
4. ✅ **Enable Content Security Policy** (`tauri.conf.json`)
5. **Remove key file fallback, require keychain** (`storage.rs`)
6. **Add query size/complexity limits** (`commands.rs`)
7. ✅ **Add input validation on connection config** (`commands.rs`)
8. **Implement rate limiting on commands**
9. **Zero credentials from memory after use**
10. ✅ **Fix silent error handling in import** (`commands.rs`)
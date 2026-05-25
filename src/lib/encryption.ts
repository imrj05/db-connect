import CryptoJS from "crypto-js";

/**
 * Utility for client-side encryption of non-sensitive data.
 * NOTE: For credential storage, the Rust backend uses AES-256-GCM
 * with keys stored in the OS keychain (see src-tauri/src/storage.rs).
 * This module is only for lightweight client-side data obfuscation.
 */

const MIN_KEY_LENGTH = 8;

/**
 * Legacy key used for v3 localStorage migration only.
 * DO NOT use this key for new encryption — it is hardcoded and known.
 * This constant will be removed after migration support is no longer needed.
 */
const _LEGACY_KEY = "db-connect-secret-key-123";

function validateKey(key: string): boolean {
	return key.length >= MIN_KEY_LENGTH;
}

/**
 * Attempt to decrypt legacy localStorage data using the known v3 key.
 * This is ONLY for one-time migration — do not use for new data.
 * @internal
 */
function tryLegacyDecrypt(ciphertext: string): any | null {
	try {
		const bytes = CryptoJS.AES.decrypt(ciphertext, _LEGACY_KEY);
		const decryptedData = bytes.toString(CryptoJS.enc.Utf8);
		if (!decryptedData) return null;
		return JSON.parse(decryptedData);
	} catch {
		return null;
	}
}

export const EncryptionUtils = {
	/**
	 * Encrypt data with the provided key.
	 * @param data - The data to encrypt (will be JSON-stringified)
	 * @param key - The encryption key (must be at least 8 characters)
	 */
	encrypt: (data: any, key: string): string => {
		if (!validateKey(key)) {
			console.error(`Encryption key must be at least ${MIN_KEY_LENGTH} characters`);
			return "";
		}
		try {
			const str = JSON.stringify(data);
			return CryptoJS.AES.encrypt(str, key).toString();
		} catch (e) {
			console.error("Encryption failed", e);
			return "";
		}
	},

	/**
	 * Decrypt ciphertext with the provided key.
	 * @param ciphertext - The encrypted string
	 * @param key - The decryption key (must be at least 8 characters)
	 */
	decrypt: (ciphertext: string, key: string): any => {
		if (!validateKey(key)) {
			console.error(`Decryption key must be at least ${MIN_KEY_LENGTH} characters`);
			return null;
		}
		try {
			const bytes = CryptoJS.AES.decrypt(ciphertext, key);
			const decryptedData = bytes.toString(CryptoJS.enc.Utf8);
			if (!decryptedData) {
				return null;
			}
			return JSON.parse(decryptedData);
		} catch (e) {
			console.error("Decryption failed", e);
			return null;
		}
	},

	/**
	 * Check if a key meets minimum requirements.
	 */
	isValidKey: (key: string): boolean => validateKey(key),

	/**
	 * Attempt to decrypt using the legacy v3 key for migration.
	 * Returns null if decryption fails or key is invalid.
	 */
	tryMigrateLegacy: (ciphertext: string): any | null => {
		if (!ciphertext || ciphertext.trim() === "") return null;
		return tryLegacyDecrypt(ciphertext);
	},
};

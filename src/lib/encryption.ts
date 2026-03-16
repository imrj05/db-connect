import CryptoJS from "crypto-js";

const DEFAULT_KEY = "db-connect-secret-key-123";

export const EncryptionUtils = {
	encrypt: (data: any, key: string = DEFAULT_KEY): string => {
		try {
			const str = JSON.stringify(data);
			return CryptoJS.AES.encrypt(str, key).toString();
		} catch (e) {
			console.error("Encryption failed", e);
			return "";
		}
	},

	decrypt: (ciphertext: string, key: string = DEFAULT_KEY): any => {
		try {
			const bytes = CryptoJS.AES.decrypt(ciphertext, key);
			const decryptedData = bytes.toString(CryptoJS.enc.Utf8);
			return JSON.parse(decryptedData);
		} catch (e) {
			console.error("Decryption failed", e);
			return null;
		}
	},
};

// ============================================
// platform/infrastructure/cache/cache-cipher.ts — personal data is encrypted inside Redis (ADR 072)
// ============================================
// AES-256-GCM with the `CACHE_ENCRYPTION_KEYS` ring: the highest version encrypts, and the version is
// part of the cache key (`cache-keys.ts`), so a rotation turns old entries into misses. The full Redis
// key is the additional authenticated data: a ciphertext copied to another key does not decrypt.

import { formatGcmEnvelope, gcmDecrypt, gcmEncrypt, parseGcmEnvelope } from "../encryption/aes-256-gcm";

export interface CacheCipher {
	/** The version that encrypts, part of every encrypted cache key. */
	readonly keyVersion: number;
	encrypt(plaintext: string, key: string): string;
	/** Throws when the value does not authenticate (wrong key, tampered, copied). */
	decrypt(ciphertext: string, key: string): string;
}

export class GcmCacheCipher implements CacheCipher {
	public readonly keyVersion: number;
	private readonly key: Buffer;

	public constructor(keys: Readonly<Record<number, string>>) {
		const versions = Object.keys(keys).map(Number);
		this.keyVersion = Math.max(...versions);
		const material = keys[this.keyVersion];
		if (material === undefined) {
			throw new Error("CACHE_ENCRYPTION_KEYS has no key for its highest version");
		}
		this.key = Buffer.from(material, "base64");
	}

	public encrypt(plaintext: string, key: string): string {
		return formatGcmEnvelope(gcmEncrypt(this.key, Buffer.from(plaintext, "utf8"), Buffer.from(key, "utf8")));
	}

	public decrypt(ciphertext: string, key: string): string {
		return gcmDecrypt(this.key, parseGcmEnvelope(ciphertext), Buffer.from(key, "utf8")).toString("utf8");
	}
}

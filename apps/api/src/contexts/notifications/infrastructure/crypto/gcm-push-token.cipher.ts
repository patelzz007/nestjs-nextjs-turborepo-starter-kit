// ============================================
// notifications/infrastructure/crypto/gcm-push-token.cipher.ts — push tokens encrypted at rest (ADR 070)
// ============================================
// AES-256-GCM with the `NOTIFICATIONS_ENCRYPTION_KEYS` ring: `v<version>:<iv>:<tag>:<data>`. The highest
// version encrypts; every version still decrypts, so a rotation never strands a device. The device id is
// the additional authenticated data: a token copied to another row does not decrypt.

import { formatGcmEnvelope, gcmDecrypt, gcmEncrypt, parseGcmEnvelope } from "../../../../platform/infrastructure/encryption/aes-256-gcm";
import type { PushTokenCipher } from "../../application/ports/push-token-cipher.port";

const VERSIONED_PATTERN = /^v(?<version>\d+):(?<envelope>.+)$/;

export class PushTokenCipherUnavailableError extends Error {
	public constructor() {
		super("NOTIFICATIONS_ENCRYPTION_KEYS is not set: push devices cannot be registered");
		this.name = "PushTokenCipherUnavailableError";
	}
}

export class GcmPushTokenCipher implements PushTokenCipher {
	public readonly available: boolean;
	private readonly keys: ReadonlyMap<number, Buffer>;
	private readonly currentVersion: number;

	public constructor(keys: Readonly<Record<number, string>> | null) {
		const entries = Object.entries(keys ?? {}).map(([version, material]): [number, Buffer] => [Number(version), Buffer.from(material, "base64")]);
		this.keys = new Map<number, Buffer>(entries);
		this.available = entries.length > 0;
		this.currentVersion = Math.max(0, ...entries.map(([version]): number => version));
	}

	public encrypt(token: string, deviceId: string): string {
		const key = this.keys.get(this.currentVersion);
		if (key === undefined) {
			throw new PushTokenCipherUnavailableError();
		}
		return `v${String(this.currentVersion)}:${formatGcmEnvelope(gcmEncrypt(key, Buffer.from(token, "utf8"), Buffer.from(deviceId, "utf8")))}`;
	}

	public decrypt(ciphertext: string, deviceId: string): string {
		const groups = VERSIONED_PATTERN.exec(ciphertext)?.groups;
		const key = groups?.version === undefined ? undefined : this.keys.get(Number(groups.version));
		if (key === undefined || groups?.envelope === undefined) {
			throw new PushTokenCipherUnavailableError();
		}
		return gcmDecrypt(key, parseGcmEnvelope(groups.envelope), Buffer.from(deviceId, "utf8")).toString("utf8");
	}
}

// ============================================
// webhook-secret.cipher.ts - Seals an endpoint's signing secret at rest
// ============================================
// AES-256-GCM under `WEBHOOK_SECRET_ENCRYPTION_KEYS` (a versioned key ring: the highest version seals, every
// version opens), with the endpoint id as additional authenticated data: a ciphertext copied onto another
// endpoint's row does not open. Stored as `<key version>:<iv>:<tag>:<ciphertext>`, so a key rotation needs no
// extra column. Secrets are `whsec_` + 32 random bytes in base64url (ADR 082).

import { randomBytes } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { WEBHOOK_SECRET_HINT_LENGTH, WEBHOOK_SECRET_PREFIX } from "@workspace/shared";

import { TypedConfigService } from "../../../../../config/typed-config.service";
import { AES_256_KEY_BYTES, formatGcmEnvelope, gcmDecrypt, gcmEncrypt, parseGcmEnvelope } from "../../../../../platform/infrastructure/encryption/aes-256-gcm";
import { WebhooksNotConfiguredError } from "../../domain/errors/webhooks.errors";
import type { NewWebhookSecret, WebhookSecretsPort } from "../../application/ports/webhook-secrets.port";

/** Random bytes in a secret: 256 bits, the HMAC-SHA256 key size. */
const SECRET_RANDOM_BYTES = 32;
/** `<version>:<rest>`: the key version, then the GCM envelope. */
const SEALED_PATTERN = /^(?<version>[1-9]\d*):(?<envelope>.+)$/;

/** A stored secret that no configured key opens (a removed key version, a tampered or moved row). */
export class WebhookSecretUnreadableError extends Error {
	public constructor(message: string) {
		super(`Webhook signing secret cannot be opened: ${message}`);
		this.name = "WebhookSecretUnreadableError";
	}
}

function endpointContext(endpointId: string): Buffer {
	return Buffer.from(`webhook-endpoint-secret:${endpointId}`, "utf8");
}

@Injectable()
export class WebhookSecretCipher implements WebhookSecretsPort {
	public constructor(private readonly config: TypedConfigService) {}

	public isConfigured(): boolean {
		return this.config.webhooks.secretEncryptionKeys !== null;
	}

	public create(endpointId: string): NewWebhookSecret {
		const keys = this.keyRing();
		const version = Math.max(...Object.keys(keys).map(Number));
		const plaintext = `${WEBHOOK_SECRET_PREFIX}${randomBytes(SECRET_RANDOM_BYTES).toString("base64url")}`;
		const envelope = gcmEncrypt(this.keyOf(keys, version), Buffer.from(plaintext, "utf8"), endpointContext(endpointId));
		return { plaintext, sealed: { ciphertext: `${String(version)}:${formatGcmEnvelope(envelope)}`, hint: plaintext.slice(-WEBHOOK_SECRET_HINT_LENGTH) } };
	}

	public open(ciphertext: string, endpointId: string): string {
		const groups = SEALED_PATTERN.exec(ciphertext)?.groups;
		const version = groups?.version;
		const envelope = groups?.envelope;
		if (version === undefined || envelope === undefined) {
			throw new WebhookSecretUnreadableError("not a sealed secret");
		}
		return gcmDecrypt(this.keyOf(this.keyRing(), Number(version)), parseGcmEnvelope(envelope), endpointContext(endpointId)).toString("utf8");
	}

	private keyRing(): Readonly<Record<number, string>> {
		const keys = this.config.webhooks.secretEncryptionKeys;
		if (keys === null) {
			throw new WebhooksNotConfiguredError();
		}
		return keys;
	}

	private keyOf(keys: Readonly<Record<number, string>>, version: number): Buffer {
		const material = keys[version];
		if (material === undefined) {
			throw new WebhookSecretUnreadableError(`key version ${String(version)} is not in WEBHOOK_SECRET_ENCRYPTION_KEYS`);
		}
		const key = Buffer.from(material, "base64");
		if (key.length !== AES_256_KEY_BYTES) {
			throw new WebhookSecretUnreadableError(`key version ${String(version)} is not ${String(AES_256_KEY_BYTES)} bytes`);
		}
		return key;
	}
}

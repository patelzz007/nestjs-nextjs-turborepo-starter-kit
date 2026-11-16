import { hkdfSync } from "node:crypto";

import { DocsWebhookHandshakeSchema, epochMs, JsonValueSchema, type DocsSourceKind, type DocsWebhookHandshake } from "@workspace/shared";
import { z } from "zod";

import type { Clock } from "../../../platform/application/clock.port";
import { AES_256_KEY_BYTES, formatGcmEnvelope, gcmDecrypt, gcmEncrypt, GcmEnvelopeError, parseGcmEnvelope } from "../../../platform/infrastructure/encryption/aes-256-gcm";
import type { RedisNamespace } from "../../../platform/infrastructure/redis/redis-namespace";
import type { DocsWebhookHandshakeStorePort } from "../application/ports/docs-publishing.ports";

/**
 * Holds a webhook's verification token until an operator copies it (ADR 084). The token becomes a signing secret,
 * so it is kept encrypted and only for an hour; Notion can send it again. The key is derived from the API's own
 * secret, so this needs no setting of its own: rotating that secret only forgets a waiting token, which is harmless.
 */

export const HANDSHAKE_TTL_MS = 3_600_000;
const KEY_DERIVATION_LABEL = "docs-publishing:webhook-handshake";

function handshakeKey(rootSecret: string): Buffer {
	return Buffer.from(hkdfSync("sha256", rootSecret, Buffer.alloc(0), KEY_DERIVATION_LABEL, AES_256_KEY_BYTES));
}

const StoredHandshakeSchema = z.object({ sealedToken: z.string().min(1), receivedAt: z.number().int() });
type StoredHandshake = z.output<typeof StoredHandshakeSchema>;
/** Redis is shared infrastructure: what comes back is never trusted to be what was written. */
const StoredHandshakeTextSchema = z
	.string()
	.pipe(z.preprocess((text: string): z.input<typeof JsonValueSchema> => JsonValueSchema.parse(JSON.parse(text)), StoredHandshakeSchema));

function seal(rootSecret: string, source: DocsSourceKind, token: string, receivedAt: number): StoredHandshake {
	const envelope = gcmEncrypt(handshakeKey(rootSecret), Buffer.from(token, "utf8"), Buffer.from(source, "utf8"));
	return { sealedToken: formatGcmEnvelope(envelope), receivedAt };
}

/** A stored token, or null when it cannot be opened: unreadable counts as absent, and Notion can send it again. */
function open(rootSecret: string, source: DocsSourceKind, stored: StoredHandshake): DocsWebhookHandshake | null {
	try {
		const token = gcmDecrypt(handshakeKey(rootSecret), parseGcmEnvelope(stored.sealedToken), Buffer.from(source, "utf8")).toString("utf8");
		return DocsWebhookHandshakeSchema.parse({ source, verificationToken: token, receivedAt: epochMs(stored.receivedAt) });
	} catch (error: unknown) {
		if (error instanceof GcmEnvelopeError) {
			return null;
		}
		throw error;
	}
}

/** The part of Redis this store uses. */
export interface HandshakeRedis {
	get(key: string): Promise<string | null>;
	set(key: string, value: string, mode: "PX", ttlMs: number): Promise<string | null>;
}

export class RedisWebhookHandshakeStore implements DocsWebhookHandshakeStorePort {
	public constructor(
		private readonly redis: HandshakeRedis,
		private readonly namespace: RedisNamespace,
		private readonly rootSecret: string,
		private readonly clock: Clock,
	) {}

	public async put(source: DocsSourceKind, verificationToken: string): Promise<void> {
		const stored = seal(this.rootSecret, source, verificationToken, this.clock.now());
		await this.redis.set(this.key(source), JSON.stringify(stored), "PX", HANDSHAKE_TTL_MS);
	}

	public async find(source: DocsSourceKind): Promise<DocsWebhookHandshake | null> {
		const raw = await this.redis.get(this.key(source));
		if (raw === null) {
			return null;
		}
		const parsed = StoredHandshakeTextSchema.safeParse(raw);
		return parsed.success ? open(this.rootSecret, source, parsed.data) : null;
	}

	private key(source: DocsSourceKind): string {
		return this.namespace.key(`docs-publishing:handshake:${source}`);
	}
}

/** For a deployment without Redis (one instance only) and for tests. */
export class InMemoryWebhookHandshakeStore implements DocsWebhookHandshakeStorePort {
	private readonly stored = new Map<DocsSourceKind, StoredHandshake>();

	public constructor(
		private readonly rootSecret: string,
		private readonly clock: Clock,
	) {}

	public put(source: DocsSourceKind, verificationToken: string): Promise<void> {
		this.stored.set(source, seal(this.rootSecret, source, verificationToken, this.clock.now()));
		return Promise.resolve();
	}

	public find(source: DocsSourceKind): Promise<DocsWebhookHandshake | null> {
		const stored = this.stored.get(source);
		if (stored === undefined || this.clock.now() - stored.receivedAt >= HANDSHAKE_TTL_MS) {
			return Promise.resolve(null);
		}
		return Promise.resolve(open(this.rootSecret, source, stored));
	}
}

// Signs a webhook the way Resend does (the standard-webhooks scheme), for `dev.ts webhook-signature`.

import { createHmac } from "node:crypto";

const SECRET_PREFIX = "whsec_";
const SIGNATURE_VERSION = "v1";

/** What a standard-webhooks sender attaches to `payload`: the message id, its send time and the signature. */
export interface SignedWebhook {
	readonly id: string;
	readonly timestamp: string;
	readonly signature: string;
}

/**
 * Signs `payload` as message `id` sent at `timestampSeconds`: HMAC-SHA256 over `<id>.<timestamp>.<payload>`
 * with the base64-decoded part of `secret` after `whsec_`. Refuses a secret that is not a `whsec_` one.
 */
export function signStandardWebhook(secret: string, id: string, timestampSeconds: number, payload: string): SignedWebhook {
	if (!secret.startsWith(SECRET_PREFIX)) {
		throw new Error("RESEND_WEBHOOK_SECRET must be Resend's webhook signing secret (whsec_…): Resend dashboard → Webhooks → your webhook → Signing secret.");
	}
	const key = Buffer.from(secret.slice(SECRET_PREFIX.length), "base64");
	const timestamp = String(timestampSeconds);
	const signature = createHmac("sha256", key).update(`${id}.${timestamp}.${payload}`).digest("base64");
	return { id, timestamp, signature: `${SIGNATURE_VERSION},${signature}` };
}

/** The HTTP headers carrying a {@link SignedWebhook}. */
export function standardWebhookHeaders(signed: SignedWebhook): ReadonlyMap<string, string> {
	return new Map([
		["webhook-id", signed.id],
		["webhook-timestamp", signed.timestamp],
		["webhook-signature", signed.signature],
	]);
}

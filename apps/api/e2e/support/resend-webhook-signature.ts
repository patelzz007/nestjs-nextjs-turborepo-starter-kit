import { createHmac } from "node:crypto";

import { TEST_API_SECRETS } from "./test-api-env";

/** TEST-ONLY webhook signing secret (standard-webhooks format: `whsec_` + base64 key) — the one the test env forces. */
export const TEST_RESEND_WEBHOOK_SECRET: string = requireSecret(TEST_API_SECRETS.RESEND_WEBHOOK_SECRET);

function requireSecret(value: string | undefined): string {
	if (value === undefined) {
		throw new Error("TEST_API_SECRETS.RESEND_WEBHOOK_SECRET must be set");
	}
	return value;
}

const MS_PER_SECOND = 1_000;

/** HTTP headers of a signed delivery: content type + `webhook-id` / `webhook-timestamp` / `webhook-signature`. */
export type SignedWebhookHeaders = Readonly<Record<string, string>>;

/**
 * Sign `body` exactly as Resend does (standard-webhooks): HMAC-SHA256 over
 * `<id>.<timestamp>.<body>` with the base64-decoded part of the secret after
 * `whsec_`, sent as `v1,<base64 signature>`. Tests sign real payloads so the
 * controller's REAL signature verification runs.
 */
export function signResendWebhook(body: string, options: { readonly webhookId: string; readonly secret?: string; readonly signedAtMs?: number }): SignedWebhookHeaders {
	const secret = options.secret ?? TEST_RESEND_WEBHOOK_SECRET;
	const timestamp = String(Math.floor((options.signedAtMs ?? Date.now()) / MS_PER_SECOND));
	const key: Buffer = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
	const signature: string = createHmac("sha256", key).update(`${options.webhookId}.${timestamp}.${body}`).digest("base64");
	return { "content-type": "application/json", "webhook-id": options.webhookId, "webhook-timestamp": timestamp, "webhook-signature": `v1,${signature}` };
}

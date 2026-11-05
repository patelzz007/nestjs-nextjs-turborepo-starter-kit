import { createHmac } from "node:crypto";

import { WEBHOOK_ID_HEADER, WEBHOOK_SIGNATURE_HEADER, WEBHOOK_TIMESTAMP_HEADER } from "@workspace/shared";

/**
 * How a delivery is signed (ADR 082, a timestamped HMAC like Stripe's): the receiver recomputes
 * `HMAC-SHA256(secret, "<timestamp>.<raw body>")` and compares it with each `v1=` of `Webhook-Signature`. During a
 * secret rotation's grace both secrets sign, so a receiver that still holds the previous one keeps accepting.
 */

const MS_PER_SECOND = 1000;

/** The unix-seconds signing time of `nowMs`. */
export function signingTimestamp(nowMs: number): number {
	return Math.floor(nowMs / MS_PER_SECOND);
}

/** `v1=<hex>` for one secret. */
function signatureWith(secret: string, timestamp: number, body: string): string {
	return `v1=${createHmac("sha256", secret)
		.update(`${String(timestamp)}.${body}`)
		.digest("hex")}`;
}

/** `t=<timestamp>,v1=<hex>[,v1=<hex>]`: one `v1=` per signing secret, the current one first. */
export function webhookSignatureHeader(secrets: readonly string[], timestamp: number, body: string): string {
	return [`t=${String(timestamp)}`, ...secrets.map((secret: string): string => signatureWith(secret, timestamp, body))].join(",");
}

/** Every header a delivery is sent with. */
export function webhookDeliveryHeaders(input: {
	readonly deliveryId: string;
	readonly secrets: readonly string[];
	readonly timestamp: number;
	readonly body: string;
}): Readonly<Record<string, string>> {
	return {
		"content-type": "application/json",
		"user-agent": "Webhooks/1",
		[WEBHOOK_ID_HEADER.toLowerCase()]: input.deliveryId,
		[WEBHOOK_TIMESTAMP_HEADER.toLowerCase()]: String(input.timestamp),
		[WEBHOOK_SIGNATURE_HEADER.toLowerCase()]: webhookSignatureHeader(input.secrets, input.timestamp, input.body),
	};
}

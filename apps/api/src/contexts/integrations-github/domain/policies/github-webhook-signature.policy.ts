// ============================================
// github-webhook-signature.ts - Is this delivery really from GitHub? (ADR 052)
// ============================================
// GitHub signs every delivery with the webhook's secret: `X-Hub-Signature-256`
// is `sha256=` + the hex HMAC-SHA256 of the raw request body. It is checked on
// the exact bytes received, in constant time, before anything in the body is
// read — a delivery that fails is never parsed.

import { createHmac, timingSafeEqual } from "node:crypto";

const SIGNATURE_PREFIX = "sha256=";
const SHA256_HEX_LENGTH = 64;
const HEX_PATTERN = /^[0-9a-f]+$/u;

/** The signature header GitHub would send for `rawBody` under `secret`. */
export function githubWebhookSignature(secret: string, rawBody: Buffer): string {
	return `${SIGNATURE_PREFIX}${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
}

/** Whether `header` is GitHub's signature of exactly `rawBody` under `secret`. */
export function isValidGithubWebhookSignature(secret: string, rawBody: Buffer, header: string | undefined): boolean {
	if (!header?.startsWith(SIGNATURE_PREFIX)) {
		return false;
	}
	const provided = header.slice(SIGNATURE_PREFIX.length).toLowerCase();
	if (provided.length !== SHA256_HEX_LENGTH || !HEX_PATTERN.test(provided)) {
		return false;
	}
	const expected = createHmac("sha256", secret).update(rawBody).digest();
	return timingSafeEqual(Buffer.from(provided, "hex"), expected);
}

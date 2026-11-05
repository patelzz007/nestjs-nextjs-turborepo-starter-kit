// ============================================
// github-webhook-signature.policy.ts - Is this delivery really from GitHub? (ADR 052, ADR 081)
// ============================================
// GitHub signs every delivery with the webhook's secret: `X-Hub-Signature-256` is `sha256=` + the hex
// HMAC-SHA256 of the raw request body. The scheme itself is the shared inbound-webhook one (checked on the
// exact bytes received, in constant time, before anything in the body is read); this file only says where
// GitHub puts it.

import { HmacSha256HeaderVerifier, hmacSha256HeaderSignature, type HmacSha256HeaderScheme, type WebhookSignatureVerifier } from "../../../webhooks/inbound/public-api";

export const GITHUB_SIGNATURE_SCHEME: HmacSha256HeaderScheme = { header: "x-hub-signature-256", prefix: "sha256=" };

/** The signature header GitHub would send for `rawBody` under `secret`. */
export function githubWebhookSignature(secret: string, rawBody: Buffer): string {
	return hmacSha256HeaderSignature(GITHUB_SIGNATURE_SCHEME, secret, rawBody);
}

/** GitHub's signature check, keyed with the server's webhook secret. */
export function githubSignatureVerifier(secret: string): WebhookSignatureVerifier {
	return new HmacSha256HeaderVerifier(GITHUB_SIGNATURE_SCHEME, secret);
}

// ============================================
// notifications/infrastructure/crypto/twilio-signature.ts — is this callback really from Twilio? (ADR 070)
// ============================================
// Twilio signs `<full URL><key1><value1><key2><value2>…` (POST params sorted by key) with HMAC-SHA1 of
// the account's auth token, base64, in `X-Twilio-Signature`.

import { createHmac, timingSafeEqual } from "node:crypto";

export function twilioSignature(authToken: string, url: string, params: Readonly<Record<string, string>>): string {
	const data = Object.keys(params)
		.sort()
		.reduce((joined: string, key: string): string => `${joined}${key}${params[key] ?? ""}`, url);
	return createHmac("sha1", authToken).update(data).digest("base64");
}

export function isValidTwilioSignature(authToken: string, url: string, params: Readonly<Record<string, string>>, signature: string): boolean {
	const expected = Buffer.from(twilioSignature(authToken, url, params));
	const given = Buffer.from(signature);
	return expected.length === given.length && timingSafeEqual(expected, given);
}

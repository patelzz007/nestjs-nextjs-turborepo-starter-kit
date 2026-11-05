// ============================================
// twilio-request.signature.ts - Twilio's request signature (ADR 070, ADR 081)
// ============================================
// Twilio signs `<full URL><key1><value1><key2><value2>…` (the POST form fields sorted by key) with
// HMAC-SHA1 of the account's auth token, base64, in `X-Twilio-Signature`. The URL is part of what is signed,
// so the verifier is keyed with the exact public URL Twilio posted to. Twilio signs no timestamp; a replay is
// caught by the delivery id.

import { createHmac } from "node:crypto";

import { formFields } from "../form-fields";
import { presentHeader, type InboundWebhookRequest } from "../inbound-webhook-request";
import { constantTimeEquals, invalidSignature, missingSignature, VALID_SIGNATURE, type SignatureCheck, type WebhookSignatureVerifier } from "../signature-check";

export const TWILIO_SIGNATURE_HEADER = "x-twilio-signature";

/** The signature Twilio sends for a POST of `params` to `url`. */
export function twilioSignature(authToken: string, url: string, params: Readonly<Record<string, string>>): string {
	const data = Object.keys(params)
		.sort()
		.reduce((joined: string, key: string): string => `${joined}${key}${params[key] ?? ""}`, url);
	return createHmac("sha1", authToken).update(data).digest("base64");
}

export class TwilioSignatureVerifier implements WebhookSignatureVerifier {
	public constructor(
		private readonly authToken: string,
		/** The full public URL Twilio posted to. */
		private readonly url: string,
	) {}

	public verify(request: InboundWebhookRequest): SignatureCheck {
		const presented = presentHeader(request.headers, TWILIO_SIGNATURE_HEADER);
		if (presented === undefined) {
			return missingSignature(`no ${TWILIO_SIGNATURE_HEADER} header`);
		}
		const expected = twilioSignature(this.authToken, this.url, Object.fromEntries(formFields(request.rawBody)));
		return constantTimeEquals(Buffer.from(presented), Buffer.from(expected)) ? VALID_SIGNATURE : invalidSignature("signature does not match the URL and fields");
	}
}

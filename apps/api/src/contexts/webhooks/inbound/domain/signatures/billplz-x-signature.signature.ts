// ============================================
// billplz-x-signature.signature.ts - Billplz's `x_signature` (ADR 020, ADR 081)
// ============================================
// Billplz posts its bill callback as a form, signed in one of its own fields, `x_signature`: HMAC-SHA256
// (hex), keyed by the X Signature key, over every other field as `key + value`, sorted ascending
// (case-insensitive) and joined with `|`. Billplz signs no timestamp; a replay is caught by the delivery id.

import { createHmac } from "node:crypto";

import { formFields } from "../form-fields";
import type { InboundWebhookRequest } from "../inbound-webhook-request";
import { constantTimeEquals, invalidSignature, missingSignature, VALID_SIGNATURE, type SignatureCheck, type WebhookSignatureVerifier } from "../signature-check";

/** The form field that carries the signature (it is not part of what is signed). */
export const BILLPLZ_SIGNATURE_FIELD = "x_signature";
const HEX_SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const SOURCE_SEPARATOR = "|";

/** The `x_signature` source string of a set of fields (every field but the signature itself). */
export function billplzSignatureSource(fields: ReadonlyMap<string, string>): string {
	return [...fields.entries()]
		.filter(([key]) => key !== BILLPLZ_SIGNATURE_FIELD)
		.map(([key, value]) => `${key}${value}`)
		.sort((left, right) => left.toLowerCase().localeCompare(right.toLowerCase(), "en"))
		.join(SOURCE_SEPARATOR);
}

/** HMAC-SHA256 (hex) of the source string with the X Signature key. */
export function billplzSignature(fields: ReadonlyMap<string, string>, key: string): string {
	return createHmac("sha256", key).update(billplzSignatureSource(fields)).digest("hex");
}

export class BillplzSignatureVerifier implements WebhookSignatureVerifier {
	public constructor(private readonly xSignatureKey: string) {}

	public verify(request: InboundWebhookRequest): SignatureCheck {
		const fields = formFields(request.rawBody);
		const presented = fields.get(BILLPLZ_SIGNATURE_FIELD);
		if (presented === undefined || presented.length === 0) {
			return missingSignature(`no ${BILLPLZ_SIGNATURE_FIELD} field`);
		}
		if (!HEX_SHA256_PATTERN.test(presented)) {
			return invalidSignature(`${BILLPLZ_SIGNATURE_FIELD} is not a hex HMAC-SHA256`);
		}
		const expected = Buffer.from(billplzSignature(fields, this.xSignatureKey), "hex");
		return constantTimeEquals(Buffer.from(presented, "hex"), expected) ? VALID_SIGNATURE : invalidSignature("signature does not match the fields");
	}
}

// ============================================
// hmac-sha256-header.signature.ts - HMAC-SHA256 of the raw body, hex, in a header (ADR 081)
// ============================================
// GitHub (`X-Hub-Signature-256: sha256=<hex>`, ADR 052) and the fake payment gateway
// (`x-fake-signature: <hex>`, ADR 020). Checked on the exact bytes received, in constant time,
// before anything in the body is read. Neither provider signs a timestamp: a replay is caught
// by the delivery id instead (ADR 081 §Delivery ids).

import { createHmac } from "node:crypto";

import { presentHeader, type InboundWebhookRequest } from "../inbound-webhook-request";
import { constantTimeEquals, invalidSignature, missingSignature, VALID_SIGNATURE, type SignatureCheck, type WebhookSignatureVerifier } from "../signature-check";

const SHA256_HEX_LENGTH = 64;
const HEX_PATTERN = /^[0-9a-f]+$/u;

/** Where a provider puts its signature. */
export interface HmacSha256HeaderScheme {
	/** The header, lower-case. */
	readonly header: string;
	/** What precedes the hex digest: `sha256=` for GitHub, nothing for the fake gateway. */
	readonly prefix: string;
}

/** The header value a provider would send for `rawBody` under `secret`. */
export function hmacSha256HeaderSignature(scheme: HmacSha256HeaderScheme, secret: string, rawBody: Buffer): string {
	return `${scheme.prefix}${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
}

export class HmacSha256HeaderVerifier implements WebhookSignatureVerifier {
	public constructor(
		private readonly scheme: HmacSha256HeaderScheme,
		private readonly secret: string,
	) {}

	public verify(request: InboundWebhookRequest): SignatureCheck {
		const presented = presentHeader(request.headers, this.scheme.header);
		if (presented === undefined) {
			return missingSignature(`no ${this.scheme.header} header`);
		}
		if (!presented.startsWith(this.scheme.prefix)) {
			return invalidSignature(`${this.scheme.header} does not start with "${this.scheme.prefix}"`);
		}
		const digest = presented.slice(this.scheme.prefix.length).toLowerCase();
		if (digest.length !== SHA256_HEX_LENGTH || !HEX_PATTERN.test(digest)) {
			return invalidSignature(`${this.scheme.header} is not a hex HMAC-SHA256`);
		}
		const expected = createHmac("sha256", this.secret).update(request.rawBody).digest();
		return constantTimeEquals(Buffer.from(digest, "hex"), expected) ? VALID_SIGNATURE : invalidSignature("signature does not match the body");
	}
}

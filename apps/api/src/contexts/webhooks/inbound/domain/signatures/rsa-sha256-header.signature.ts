// ============================================
// rsa-sha256-header.signature.ts - An RSA signature of the raw body, base64, in a header (ADR 081)
// ============================================
// CHIP (ADR 020): `X-Signature` is base64 of an RSA PKCS#1 v1.5 signature of the SHA-256 of the raw body,
// verified with the company public key (CHIP_PUBLIC_KEY). Only CHIP can sign — the server holds the public
// half alone. CHIP signs no timestamp; a replay is caught by the delivery id.

import { createPublicKey, verify } from "node:crypto";

import { presentHeader, type InboundWebhookRequest } from "../inbound-webhook-request";
import { invalidSignature, missingSignature, VALID_SIGNATURE, type SignatureCheck, type WebhookSignatureVerifier } from "../signature-check";

export class RsaSha256HeaderVerifier implements WebhookSignatureVerifier {
	public constructor(
		/** The header, lower-case. */
		private readonly header: string,
		/** The provider's public key (PEM). */
		private readonly publicKeyPem: string,
	) {}

	public verify(request: InboundWebhookRequest): SignatureCheck {
		const presented = presentHeader(request.headers, this.header);
		if (presented === undefined) {
			return missingSignature(`no ${this.header} header`);
		}
		try {
			return verify("sha256", request.rawBody, createPublicKey(this.publicKeyPem), Buffer.from(presented, "base64"))
				? VALID_SIGNATURE
				: invalidSignature("signature does not match the body");
		} catch {
			// A malformed key or signature cannot verify anything: refused, never a crash on a public route.
			return invalidSignature("signature or public key is malformed");
		}
	}
}

// ============================================
// standard-webhooks.signature.ts - Standard Webhooks / Svix signatures (ADR 081)
// ============================================
// Resend delivers through Svix (https://www.standardwebhooks.com): `webhook-id`, `webhook-timestamp`
// (Unix seconds) and `webhook-signature` — or the same three under `svix-*` names. The signature is
// `v1,<base64 HMAC-SHA256>` over `<id>.<timestamp>.<raw body>`, keyed by the base64 part of the
// `whsec_…` secret; the header may list several, space-separated (during a key rotation). A timestamp
// more than five minutes from now, either way, is refused — so a captured delivery cannot be replayed
// later, and the reasons are worded exactly as Svix words them (the Resend route's messages match on them).

import { createHmac } from "node:crypto";

import { presentHeader, type InboundWebhookHeaders, type InboundWebhookRequest } from "../inbound-webhook-request";
import {
	constantTimeEquals,
	invalidSignature,
	missingSignature,
	VALID_SIGNATURE,
	type EpochMsSource,
	type SignatureCheck,
	type WebhookSignatureVerifier,
} from "../signature-check";

const MS_PER_SECOND = 1_000;
/** Svix's (and the specification's) tolerance: five minutes either way. */
export const STANDARD_WEBHOOKS_TOLERANCE_SECONDS = 300;
const SECRET_PREFIX = "whsec_";
const SIGNATURE_VERSION = "v1";
const SIGNATURE_LIST_SEPARATOR = " ";
const VERSION_SEPARATOR = ",";
const UNIX_SECONDS_PATTERN = /^\d+$/u;

/** The three signed headers, under the `webhook-*` names or Svix's `svix-*` ones. */
export interface StandardWebhookHeaders {
	readonly id: string | undefined;
	readonly timestamp: string | undefined;
	readonly signature: string | undefined;
}

function standardOrSvix(headers: InboundWebhookHeaders, suffix: string): string | undefined {
	return presentHeader(headers, `webhook-${suffix}`) ?? presentHeader(headers, `svix-${suffix}`);
}

/** The signed headers of a request. */
export function standardWebhookHeaders(headers: InboundWebhookHeaders): StandardWebhookHeaders {
	return { id: standardOrSvix(headers, "id"), timestamp: standardOrSvix(headers, "timestamp"), signature: standardOrSvix(headers, "signature") };
}

/** The names of the signed headers a request lacks (`webhook-id/svix-id`, …), in order. */
export function missingStandardWebhookHeaders(headers: InboundWebhookHeaders): readonly string[] {
	return ["id", "timestamp", "signature"]
		.filter((suffix: string): boolean => standardOrSvix(headers, suffix) === undefined)
		.map((suffix: string): string => `webhook-${suffix}/svix-${suffix}`);
}

export class StandardWebhooksVerifier implements WebhookSignatureVerifier {
	private readonly key: Buffer;

	public constructor(
		secret: string,
		private readonly now: EpochMsSource,
	) {
		this.key = Buffer.from(secret.startsWith(SECRET_PREFIX) ? secret.slice(SECRET_PREFIX.length) : secret, "base64");
	}

	public verify(request: InboundWebhookRequest): SignatureCheck {
		const { id, timestamp, signature } = standardWebhookHeaders(request.headers);
		if (id === undefined || timestamp === undefined || signature === undefined) {
			return missingSignature(`Missing required headers: ${missingStandardWebhookHeaders(request.headers).join(", ")}`);
		}
		if (!UNIX_SECONDS_PATTERN.test(timestamp)) {
			return invalidSignature("Invalid Signature Headers");
		}
		const signedAt = Number(timestamp);
		const now = Math.floor(this.now() / MS_PER_SECOND);
		if (now - signedAt > STANDARD_WEBHOOKS_TOLERANCE_SECONDS) {
			return invalidSignature("Message timestamp too old");
		}
		if (signedAt - now > STANDARD_WEBHOOKS_TOLERANCE_SECONDS) {
			return invalidSignature("Message timestamp too new");
		}
		const expected = createHmac("sha256", this.key).update(`${id}.${timestamp}.`).update(request.rawBody).digest();
		const matches = signature.split(SIGNATURE_LIST_SEPARATOR).some((entry: string): boolean => {
			const [version, value] = entry.split(VERSION_SEPARATOR);
			return version === SIGNATURE_VERSION && value !== undefined && constantTimeEquals(Buffer.from(value, "base64"), expected);
		});
		return matches ? VALID_SIGNATURE : invalidSignature("No matching signature found");
	}
}

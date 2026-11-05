// ============================================
// inbound-webhook-request.ts - A webhook request exactly as it arrived (ADR 081)
// ============================================
// Every signature scheme covers bytes: the raw body itself (GitHub, Resend, CHIP, the fake gateway) or the
// form fields parsed from it (Billplz, Twilio). So a request is kept as its raw body and its headers — never
// as a parsed body, which would re-encode what was signed.

/** Header names are lower-case (as Node delivers them); a repeated header is joined with ", ". */
export type InboundWebhookHeaders = Readonly<Record<string, string | undefined>>;

/** A webhook request exactly as it arrived. */
export interface InboundWebhookRequest {
	readonly rawBody: Buffer;
	readonly headers: InboundWebhookHeaders;
}

/** A header as Node delivers it: one value, a repeated header's values, or none. */
type IncomingHeaderValue = string | readonly string[] | undefined;

/** How a repeated header's values are joined (RFC 9110 §5.3). */
const REPEATED_HEADER_SEPARATOR = ", ";

/** A request from the raw body and headers a route received (no raw body — an empty one, which no signature covers). */
export function inboundWebhookRequest(rawBody: Buffer | undefined, headers: Readonly<Record<string, IncomingHeaderValue>>): InboundWebhookRequest {
	const flattened: Record<string, string | undefined> = {};
	for (const [name, value] of Object.entries(headers)) {
		flattened[name.toLowerCase()] = value instanceof Array ? value.join(REPEATED_HEADER_SEPARATOR) : value;
	}
	return { rawBody: rawBody ?? Buffer.alloc(0), headers: flattened };
}

/** A header's value, or undefined when it is absent or empty. */
export function presentHeader(headers: InboundWebhookHeaders, name: string): string | undefined {
	const value = headers[name];
	return value === undefined || value.length === 0 ? undefined : value;
}

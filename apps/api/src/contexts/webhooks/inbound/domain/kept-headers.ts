// ============================================
// kept-headers.ts - Which request headers the received-webhook log keeps (ADR 081 §Storage)
// ============================================
// An allowlist, not a denylist: a header is kept only when it is named here, so a provider adding a new
// credential header can never leak it into the log. Never kept: any signature header (`x-hub-signature-256`,
// `webhook-signature`, `x-signature`, `x-twilio-signature`, `x-fake-signature`), `authorization`, `cookie`,
// and anything else not listed. The full redacted header set is in the request's HTTP audit row
// (same correlation id).

import { RECEIVED_WEBHOOK_HEADER_VALUE_MAX_LENGTH, type ReceivedWebhookHeaders } from "@workspace/shared";

import type { InboundWebhookHeaders } from "./inbound-webhook-request";

export const KEPT_WEBHOOK_HEADERS: readonly string[] = [
	"content-type",
	"content-length",
	"user-agent",
	// GitHub (ADR 052)
	"x-github-event",
	"x-github-delivery",
	"x-github-hook-id",
	"x-github-hook-installation-target-type",
	"x-github-hook-installation-target-id",
	// Standard Webhooks / Svix (Resend)
	"webhook-id",
	"webhook-timestamp",
	"svix-id",
	"svix-timestamp",
	// Twilio
	"i-twilio-idempotency-token",
	"x-home-region",
];

/** Ends a value cut to its budget. */
const TRUNCATION_MARK = "…";

/** The allowlisted headers of a request, each value cut to its budget. */
export function keptHeaders(headers: InboundWebhookHeaders): ReceivedWebhookHeaders {
	const kept: Record<string, string> = {};
	for (const name of KEPT_WEBHOOK_HEADERS) {
		const value = headers[name];
		if (value !== undefined) {
			kept[name] =
				value.length > RECEIVED_WEBHOOK_HEADER_VALUE_MAX_LENGTH
					? `${value.slice(0, RECEIVED_WEBHOOK_HEADER_VALUE_MAX_LENGTH - TRUNCATION_MARK.length)}${TRUNCATION_MARK}`
					: value;
		}
	}
	return kept;
}

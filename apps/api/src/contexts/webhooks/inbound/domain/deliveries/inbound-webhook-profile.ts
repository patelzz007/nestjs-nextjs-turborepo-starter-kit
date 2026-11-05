// ============================================
// inbound-webhook-profile.ts - Which delivery a verified request is (ADR 081 §Delivery ids)
// ============================================
// A provider's profile reads, from a request whose signature already verified, the delivery's identity
// (what a redelivery repeats and a new delivery never does) and the provider's name for the event. GitHub
// and Resend send their own delivery id; Billplz, CHIP, the fake gateway and Twilio send none, so one is
// derived from the signed fields that change exactly when the news does (a bill's state, a purchase's
// status and update time, a message's status). Every derived id is built from SIGNED bytes only.

import { RECEIVED_WEBHOOK_DELIVERY_ID_MAX_LENGTH, RECEIVED_WEBHOOK_EVENT_TYPE_MAX_LENGTH, type ReceivedWebhookProvider } from "@workspace/shared";
import { z } from "zod";

import type { InboundWebhookRequest } from "../inbound-webhook-request";

/** A delivery's identity and event name; either is null when the request does not carry it. */
export interface InboundWebhookEnvelope {
	readonly deliveryId: string | null;
	readonly eventType: string | null;
}

/** How one provider's deliveries are told apart. */
export interface InboundWebhookProfile {
	readonly provider: ReceivedWebhookProvider;
	/** Read only after the signature verified: nothing in an unverified request is trusted. */
	envelopeOf(request: InboundWebhookRequest): InboundWebhookEnvelope;
}

const DeliveryIdSchema = z.string().trim().min(1).max(RECEIVED_WEBHOOK_DELIVERY_ID_MAX_LENGTH);
const EventTypeSchema = z.string().trim().min(1).max(RECEIVED_WEBHOOK_EVENT_TYPE_MAX_LENGTH);

/** Separates the signed fields a derived delivery id is built from. */
export const DERIVED_DELIVERY_ID_SEPARATOR = ":";

/**
 * A delivery id from its parts, or null when a required part is missing or the id would be too long to
 * store. An optional part (a bill's `paid_at` before it is paid) is kept as an empty segment.
 */
export function deliveryIdOf(required: readonly (string | undefined)[], optional: readonly (string | undefined)[] = []): string | null {
	if (required.some((part: string | undefined): boolean => part === undefined || part.trim().length === 0)) {
		return null;
	}
	const segments = [...required, ...optional].map((part: string | undefined): string => part ?? "");
	const parsed = DeliveryIdSchema.safeParse(segments.join(DERIVED_DELIVERY_ID_SEPARATOR));
	return parsed.success ? parsed.data : null;
}

/** An event name, or null when absent or too long to store. */
export function eventTypeOf(value: string | undefined): string | null {
	const parsed = EventTypeSchema.safeParse(value);
	return parsed.success ? parsed.data : null;
}

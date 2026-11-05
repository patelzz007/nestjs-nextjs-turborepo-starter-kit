// ============================================
// provider-profiles.ts - Every inbound provider's delivery identity (ADR 081 §Delivery ids)
// ============================================
// | Provider        | Delivery id                                              | Signed?                     |
// |-----------------|----------------------------------------------------------|-----------------------------|
// | GitHub          | `X-GitHub-Delivery`                                      | no (GitHub signs the body)  |
// | Resend (Svix)   | `webhook-id` / `svix-id`                                 | yes (part of the signature) |
// | Billplz         | `id:state:paid:paid_at` (form fields)                    | yes                         |
// | CHIP            | `id:status:updated_on` (purchase JSON)                   | yes                         |
// | Fake gateway    | `id:status` (JSON)                                       | yes                         |
// | Twilio status   | `status:MessageSid:MessageStatus` (form fields)          | yes                         |
// | Twilio inbound  | `inbound:MessageSid` (form fields)                       | yes                         |
//
// GitHub's id is the one header it does not sign, so a captured delivery replayed under a new id is
// processed again — harmless, because GitHub's handler is idempotent on its own effect (ADR 052).

import { JsonValueSchema } from "@workspace/shared";
import { z } from "zod";

import { formFields } from "../form-fields";
import { presentHeader, type InboundWebhookRequest } from "../inbound-webhook-request";
import { standardWebhookHeaders } from "../signatures/standard-webhooks.signature";
import { deliveryIdOf, eventTypeOf, type InboundWebhookEnvelope, type InboundWebhookProfile } from "./inbound-webhook-profile";

/** A verified body that is not JSON reads as nothing, never as a crash. */
function jsonBody(rawBody: Buffer): z.output<typeof JsonValueSchema> | null {
	try {
		return JsonValueSchema.parse(JSON.parse(rawBody.toString("utf8")));
	} catch {
		return null;
	}
}

const NO_ENVELOPE: InboundWebhookEnvelope = { deliveryId: null, eventType: null };

export const GITHUB_WEBHOOK_PROFILE: InboundWebhookProfile = {
	provider: "GITHUB",
	envelopeOf: (request: InboundWebhookRequest): InboundWebhookEnvelope => ({
		deliveryId: deliveryIdOf([presentHeader(request.headers, "x-github-delivery")]),
		eventType: eventTypeOf(presentHeader(request.headers, "x-github-event")),
	}),
};

const ResendEventSchema = z.object({ type: z.string() });

export const RESEND_WEBHOOK_PROFILE: InboundWebhookProfile = {
	provider: "RESEND",
	envelopeOf: (request: InboundWebhookRequest): InboundWebhookEnvelope => {
		const event = ResendEventSchema.safeParse(jsonBody(request.rawBody));
		return { deliveryId: deliveryIdOf([standardWebhookHeaders(request.headers).id]), eventType: event.success ? eventTypeOf(event.data.type) : null };
	},
};

export const BILLPLZ_CALLBACK_PROFILE: InboundWebhookProfile = {
	provider: "BILLPLZ",
	envelopeOf: (request: InboundWebhookRequest): InboundWebhookEnvelope => {
		const fields = formFields(request.rawBody);
		const state = fields.get("state");
		return { deliveryId: deliveryIdOf([fields.get("id"), state, fields.get("paid")], [fields.get("paid_at")]), eventType: eventTypeOf(state) };
	},
};

const ChipPurchaseEnvelopeSchema = z.object({
	id: z.string(),
	status: z.string(),
	/** Unix seconds of the purchase's last change: two callbacks of one status differ by it. */
	updated_on: z.number().int().optional(),
	event_type: z.string().optional(),
});

export const CHIP_CALLBACK_PROFILE: InboundWebhookProfile = {
	provider: "CHIP",
	envelopeOf: (request: InboundWebhookRequest): InboundWebhookEnvelope => {
		const purchase = ChipPurchaseEnvelopeSchema.safeParse(jsonBody(request.rawBody));
		if (!purchase.success) {
			return NO_ENVELOPE;
		}
		const { id, status, updated_on: updatedOn, event_type: eventType } = purchase.data;
		return { deliveryId: deliveryIdOf([id, status], [updatedOn === undefined ? undefined : String(updatedOn)]), eventType: eventTypeOf(eventType ?? status) };
	},
};

const FakeCallbackEnvelopeSchema = z.object({ id: z.string(), status: z.string() });

export const FAKE_PAYMENT_CALLBACK_PROFILE: InboundWebhookProfile = {
	provider: "FAKE_PAYMENTS",
	envelopeOf: (request: InboundWebhookRequest): InboundWebhookEnvelope => {
		const callback = FakeCallbackEnvelopeSchema.safeParse(jsonBody(request.rawBody));
		return callback.success ? { deliveryId: deliveryIdOf([callback.data.id, callback.data.status]), eventType: eventTypeOf(callback.data.status) } : NO_ENVELOPE;
	},
};

/** Twilio status callbacks and inbound messages share one provider; their ids never collide (different prefixes). */
const TWILIO_STATUS_KIND = "status";
const TWILIO_INBOUND_KIND = "inbound";

export const TWILIO_STATUS_CALLBACK_PROFILE: InboundWebhookProfile = {
	provider: "TWILIO",
	envelopeOf: (request: InboundWebhookRequest): InboundWebhookEnvelope => {
		const fields = formFields(request.rawBody);
		const status = fields.get("MessageStatus");
		return {
			deliveryId: deliveryIdOf([TWILIO_STATUS_KIND, fields.get("MessageSid"), status]),
			eventType: status === undefined ? null : eventTypeOf(`${TWILIO_STATUS_KIND}.${status}`),
		};
	},
};

export const TWILIO_INBOUND_MESSAGE_PROFILE: InboundWebhookProfile = {
	provider: "TWILIO",
	envelopeOf: (request: InboundWebhookRequest): InboundWebhookEnvelope => ({
		deliveryId: deliveryIdOf([TWILIO_INBOUND_KIND, formFields(request.rawBody).get("MessageSid")]),
		eventType: TWILIO_INBOUND_KIND,
	}),
};

import { z } from "zod";

import { EpochMsSchema } from "../../../schemas/api/common";
import { PaymentCurrencySchema, PaymentProviderNameSchema } from "../../payments/schemas/payments";
import { SaleCurrencySchema } from "../../pos/schemas/redemption";

/**
 * The public catalog of outgoing webhook events (ADR 082), version 1. What an integrator's endpoint
 * receives is an envelope `{ id, type, apiVersion, createdAt, tenantId, data }` whose `data` is the
 * type's own payload below. Payloads carry ids and business facts only: never a customer's name, email
 * or phone number. A breaking change to any payload ships as a new `apiVersion`, never in place.
 */

/** The envelope version every v1 event carries. */
export const WEBHOOK_API_VERSION = "2026-11-01";

/** Every event type of the v1 catalog. */
export const WebhookEventTypeSchema = z.enum([
	"reward.published",
	"reward.rejected",
	"claim.created",
	"claim.redeemed",
	"claim.expired",
	"sale.completed",
	"payment.succeeded",
	"payment.failed",
	"payment.refunded",
	"webhook.test",
]);
export type WebhookEventType = z.output<typeof WebhookEventTypeSchema>;

/** The types an endpoint can subscribe to. `webhook.test` is sent on demand ("Send test"), never by subscription. */
export const WebhookSubscribableEventTypeSchema = WebhookEventTypeSchema.exclude(["webhook.test"]);
export type WebhookSubscribableEventType = z.output<typeof WebhookSubscribableEventTypeSchema>;

/** What each subscribable type means, for the endpoint form and the docs. */
export const WEBHOOK_EVENT_TYPE_DESCRIPTIONS: Readonly<Record<WebhookSubscribableEventType, string>> = {
	"reward.published": "A reward went live, after review or at its scheduled time.",
	"reward.rejected": "A reviewer sent a reward back with a reason.",
	"claim.created": "A customer claimed one of your rewards.",
	"claim.redeemed": "A claim was redeemed at one of your tills.",
	"claim.expired": "A claim ran out of time before it was redeemed.",
	"sale.completed": "A till checked out a bill with rewards on it.",
	"payment.succeeded": "A payment was paid.",
	"payment.failed": "A payment failed at the gateway.",
	"payment.refunded": "A paid payment was refunded.",
};

/** Longest free text a payload carries (a reward title, a rejection reason). */
export const WEBHOOK_PAYLOAD_TEXT_MAX_LENGTH = 2000;
/** Most claims one sale can name (a bill with every reward a customer holds). */
const WEBHOOK_SALE_MAX_CLAIMS = 100;
/** Longest gateway payment id kept (`PaymentIntent.providerPaymentId`). */
const WEBHOOK_PROVIDER_PAYMENT_ID_MAX_LENGTH = 128;

const PayloadTextSchema = z.string().min(1).max(WEBHOOK_PAYLOAD_TEXT_MAX_LENGTH);

/** How a reward went live: a reviewer approved it, or its review window elapsed. */
export const WebhookRewardPublishedViaSchema = z.enum(["review", "schedule"]);

export const WebhookRewardPublishedDataSchema = z.object({ rewardId: z.uuid(), title: PayloadTextSchema, via: WebhookRewardPublishedViaSchema }).strict();
export const WebhookRewardRejectedDataSchema = z.object({ rewardId: z.uuid(), title: PayloadTextSchema, reason: PayloadTextSchema }).strict();

/** The facts of every claim event. `isReferrerCredit`: the claim was a referrer's reward for a referral, not one the customer took. */
export const WebhookClaimDataSchema = z.object({ claimId: z.uuid(), rewardId: z.uuid(), isReferrerCredit: z.boolean() }).strict();

export const WebhookSaleCompletedDataSchema = z
	.object({
		saleId: z.uuid(),
		/** The store the till belongs to; null for a till not tied to one store. */
		locationId: z.uuid().nullable(),
		/** The merchant's own till id (as registered). */
		terminalId: z.string().min(1).max(WEBHOOK_PAYLOAD_TEXT_MAX_LENGTH),
		/** The bill total in minor units (sen). */
		billTotalMinor: z.number().int().nonnegative(),
		currency: SaleCurrencySchema,
		claimIds: z.array(z.uuid()).max(WEBHOOK_SALE_MAX_CLAIMS),
	})
	.strict();

/** The facts of every payment event (the payer's name and email are never sent). */
export const WebhookPaymentDataSchema = z
	.object({
		paymentId: z.uuid(),
		provider: PaymentProviderNameSchema,
		amountMinor: z.number().int().positive(),
		currency: PaymentCurrencySchema,
		/** The gateway's own id for the payment, once it has one. */
		providerPaymentId: z.string().min(1).max(WEBHOOK_PROVIDER_PAYMENT_ID_MAX_LENGTH).nullable(),
		paidAt: EpochMsSchema.nullable(),
	})
	.strict();

export const WebhookTestDataSchema = z.object({ endpointId: z.uuid(), message: PayloadTextSchema }).strict();

const EnvelopeBaseShape = {
	/** The event id: the same event delivered to two endpoints (or redelivered) carries the same id. */
	id: z.uuid(),
	apiVersion: z.literal(WEBHOOK_API_VERSION),
	createdAt: EpochMsSchema,
	tenantId: z.uuid(),
};

/** One outgoing webhook event, as the receiver gets it in the request body. */
export const WebhookEventEnvelopeSchema = z.discriminatedUnion("type", [
	z.object({ ...EnvelopeBaseShape, type: z.literal("reward.published"), data: WebhookRewardPublishedDataSchema }).strict(),
	z.object({ ...EnvelopeBaseShape, type: z.literal("reward.rejected"), data: WebhookRewardRejectedDataSchema }).strict(),
	z.object({ ...EnvelopeBaseShape, type: z.literal("claim.created"), data: WebhookClaimDataSchema }).strict(),
	z.object({ ...EnvelopeBaseShape, type: z.literal("claim.redeemed"), data: WebhookClaimDataSchema }).strict(),
	z.object({ ...EnvelopeBaseShape, type: z.literal("claim.expired"), data: WebhookClaimDataSchema }).strict(),
	z.object({ ...EnvelopeBaseShape, type: z.literal("sale.completed"), data: WebhookSaleCompletedDataSchema }).strict(),
	z.object({ ...EnvelopeBaseShape, type: z.literal("payment.succeeded"), data: WebhookPaymentDataSchema }).strict(),
	z.object({ ...EnvelopeBaseShape, type: z.literal("payment.failed"), data: WebhookPaymentDataSchema }).strict(),
	z.object({ ...EnvelopeBaseShape, type: z.literal("payment.refunded"), data: WebhookPaymentDataSchema }).strict(),
	z.object({ ...EnvelopeBaseShape, type: z.literal("webhook.test"), data: WebhookTestDataSchema }).strict(),
]);
export type WebhookEventEnvelope = z.output<typeof WebhookEventEnvelopeSchema>;

/** An event before it has an id and a time: its type and payload, as the producing context records it. */
export const WebhookEventDraftSchema = z.discriminatedUnion("type", [
	z.object({ type: z.literal("reward.published"), data: WebhookRewardPublishedDataSchema }).strict(),
	z.object({ type: z.literal("reward.rejected"), data: WebhookRewardRejectedDataSchema }).strict(),
	z.object({ type: z.literal("claim.created"), data: WebhookClaimDataSchema }).strict(),
	z.object({ type: z.literal("claim.redeemed"), data: WebhookClaimDataSchema }).strict(),
	z.object({ type: z.literal("claim.expired"), data: WebhookClaimDataSchema }).strict(),
	z.object({ type: z.literal("sale.completed"), data: WebhookSaleCompletedDataSchema }).strict(),
	z.object({ type: z.literal("payment.succeeded"), data: WebhookPaymentDataSchema }).strict(),
	z.object({ type: z.literal("payment.failed"), data: WebhookPaymentDataSchema }).strict(),
	z.object({ type: z.literal("payment.refunded"), data: WebhookPaymentDataSchema }).strict(),
	z.object({ type: z.literal("webhook.test"), data: WebhookTestDataSchema }).strict(),
]);
export type WebhookEventDraft = z.output<typeof WebhookEventDraftSchema>;

// ── Signature headers (documented for receivers) ─────────────────────────────

/** `t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">` (a second `v1=` during a secret rotation's grace). */
export const WEBHOOK_SIGNATURE_HEADER = "Webhook-Signature";
/** The delivery id: the same on every retry of one delivery, so a receiver can drop a repeat. */
export const WEBHOOK_ID_HEADER = "Webhook-Id";
/** The signing time in unix seconds (the same value as the signature's `t=`). */
export const WEBHOOK_TIMESTAMP_HEADER = "Webhook-Timestamp";
/** How far a receiver should accept a signature's time from its own clock (the recommendation in ADR 082). */
export const WEBHOOK_SIGNATURE_TOLERANCE_SECONDS = 300;

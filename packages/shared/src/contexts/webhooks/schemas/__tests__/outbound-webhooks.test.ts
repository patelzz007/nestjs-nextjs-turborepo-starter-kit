import { describe, expect, it } from "vitest";

import {
	WEBHOOK_API_VERSION,
	WEBHOOK_EVENT_TYPE_DESCRIPTIONS,
	WebhookEventDraftSchema,
	WebhookEventEnvelopeSchema,
	WebhookEventTypeSchema,
	WebhookSubscribableEventTypeSchema,
} from "../outbound-webhook-events";
import {
	CreateWebhookEndpointSchema,
	DEFAULT_WEBHOOK_SECRET_GRACE_HOURS,
	MAX_WEBHOOK_SECRET_GRACE_HOURS,
	RotateWebhookSecretSchema,
	UpdateWebhookEndpointSchema,
	WEBHOOK_ENDPOINT_DESCRIPTION_MAX_LENGTH,
	WEBHOOK_ENDPOINT_URL_MAX_LENGTH,
	WebhookDeliveryListQuerySchema,
	WebhookEndpointWithSecretSchema,
} from "../outbound-webhooks";

const IDS = {
	event: "0193f2c4-0000-7000-8000-000000000001",
	tenant: "0193f2c4-0000-7000-8000-000000000002",
	reward: "0193f2c4-0000-7000-8000-000000000003",
	claim: "0193f2c4-0000-7000-8000-000000000004",
	payment: "0193f2c4-0000-7000-8000-000000000005",
};
const CREATED_AT = 1_793_664_000_000;

describe("the outgoing webhook event catalog (v1)", () => {
	it("names every type once, and only the test event is not subscribable", () => {
		expect(WebhookEventTypeSchema.options).toStrictEqual([
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
		expect(WebhookSubscribableEventTypeSchema.options).not.toContain("webhook.test");
		expect(Object.keys(WEBHOOK_EVENT_TYPE_DESCRIPTIONS)).toStrictEqual(WebhookSubscribableEventTypeSchema.options);
	});

	it("keeps the draft and the envelope unions in step: one variant per type, in the same order", () => {
		const draftTypes = WebhookEventDraftSchema.options.map((variant) => variant.shape.type.value);
		const envelopeTypes = WebhookEventEnvelopeSchema.options.map((variant) => variant.shape.type.value);
		expect(draftTypes).toStrictEqual(WebhookEventTypeSchema.options);
		expect(envelopeTypes).toStrictEqual(WebhookEventTypeSchema.options);
		for (const [index, draft] of WebhookEventDraftSchema.options.entries()) {
			expect(WebhookEventEnvelopeSchema.options.at(index)?.shape.data).toBe(draft.shape.data);
		}
	});

	it("accepts a versioned envelope and refuses another version or a payload of another type", () => {
		const envelope = {
			id: IDS.event,
			type: "claim.redeemed",
			apiVersion: WEBHOOK_API_VERSION,
			createdAt: CREATED_AT,
			tenantId: IDS.tenant,
			data: { claimId: IDS.claim, rewardId: IDS.reward, isReferrerCredit: false },
		};
		expect(WebhookEventEnvelopeSchema.safeParse(envelope).success).toBe(true);
		expect(WebhookEventEnvelopeSchema.safeParse({ ...envelope, apiVersion: "2020-01-01" }).success).toBe(false);
		expect(WebhookEventEnvelopeSchema.safeParse({ ...envelope, type: "reward.published" }).success).toBe(false);
	});

	it("never carries a customer's personal data: unknown payload keys are refused", () => {
		const payment = {
			type: "payment.succeeded",
			data: { paymentId: IDS.payment, provider: "CHIP", amountMinor: 4_500, currency: "MYR", providerPaymentId: "abc", paidAt: CREATED_AT },
		};
		expect(WebhookEventDraftSchema.safeParse(payment).success).toBe(true);
		expect(WebhookEventDraftSchema.safeParse({ ...payment, data: { ...payment.data, payerEmail: "someone@example.com" } }).success).toBe(false);
	});
});

describe("the endpoint inputs", () => {
	it("defaults the description and needs at least one event, each once", () => {
		const parsed = CreateWebhookEndpointSchema.parse({ url: "https://hooks.example.com/rewards", eventTypes: ["claim.created"] });
		expect(parsed.description).toBe("");
		expect(CreateWebhookEndpointSchema.safeParse({ url: "https://hooks.example.com", eventTypes: [] }).success).toBe(false);
		expect(CreateWebhookEndpointSchema.safeParse({ url: "https://hooks.example.com", eventTypes: ["claim.created", "claim.created"] }).success).toBe(false);
		expect(CreateWebhookEndpointSchema.safeParse({ url: "https://hooks.example.com", eventTypes: ["webhook.test"] }).success).toBe(false);
	});

	it("takes only http(s) addresses within the column size, and descriptions within theirs", () => {
		expect(CreateWebhookEndpointSchema.safeParse({ url: "ftp://hooks.example.com", eventTypes: ["claim.created"] }).success).toBe(false);
		const longUrl = `https://hooks.example.com/${"a".repeat(WEBHOOK_ENDPOINT_URL_MAX_LENGTH)}`;
		expect(CreateWebhookEndpointSchema.safeParse({ url: longUrl, eventTypes: ["claim.created"] }).success).toBe(false);
		const longDescription = "d".repeat(WEBHOOK_ENDPOINT_DESCRIPTION_MAX_LENGTH + 1);
		expect(CreateWebhookEndpointSchema.safeParse({ url: "https://hooks.example.com", description: longDescription, eventTypes: ["claim.created"] }).success).toBe(false);
	});

	it("needs an update to change something", () => {
		expect(UpdateWebhookEndpointSchema.safeParse({}).success).toBe(false);
		expect(UpdateWebhookEndpointSchema.safeParse({ description: "Till sync" }).success).toBe(true);
	});

	it("keeps the previous secret for a day by default, never longer than the maximum", () => {
		expect(RotateWebhookSecretSchema.parse({}).keepPreviousForHours).toBe(DEFAULT_WEBHOOK_SECRET_GRACE_HOURS);
		expect(RotateWebhookSecretSchema.safeParse({ keepPreviousForHours: 0 }).success).toBe(true);
		expect(RotateWebhookSecretSchema.safeParse({ keepPreviousForHours: MAX_WEBHOOK_SECRET_GRACE_HOURS + 1 }).success).toBe(false);
	});

	it("answers a secret only in its recognisable form", () => {
		const endpoint = {
			id: IDS.event,
			url: "https://hooks.example.com",
			description: "",
			eventTypes: ["claim.created"],
			status: "ACTIVE",
			disabledReason: null,
			disabledAt: null,
			secretHint: "a1b2",
			previousSecretExpiresAt: null,
			consecutiveFailures: 0,
			lastDeliveryAt: null,
			version: 0,
			createdAt: CREATED_AT,
			updatedAt: CREATED_AT,
			isDeleted: false,
			deletedAt: null,
		};
		expect(WebhookEndpointWithSecretSchema.safeParse({ endpoint, secret: "whsec_abc" }).success).toBe(true);
		expect(WebhookEndpointWithSecretSchema.safeParse({ endpoint, secret: "abc" }).success).toBe(false);
	});
});

describe("the delivery log query", () => {
	it("filters by status, event type and endpoint, newest first by default", () => {
		const query = WebhookDeliveryListQuerySchema.parse({ filter: { status: { in: ["FAILED", "DEAD"] }, eventType: "claim.created", endpointId: IDS.event } });
		expect(query.filter).toStrictEqual({ status: { in: ["FAILED", "DEAD"] }, eventType: { eq: "claim.created" }, endpointId: { eq: IDS.event } });
		expect(query.sort).toBeUndefined();
		expect(WebhookDeliveryListQuerySchema.safeParse({ filter: { status: "LOST" } }).success).toBe(false);
	});
});

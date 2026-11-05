import { createHash } from "node:crypto";

import type { Prisma, ReceivedWebhookOutcome, ReceivedWebhookProvider, ReceivedWebhookVerification, WebhookDeliveryStatus } from "@prisma/client";
import { DAY_MS, WEBHOOK_API_VERSION, WebhookEventDraftSchema, type WebhookEventDraft } from "@workspace/shared";

import { getApiConfig } from "../../src/config/api-config";
import { TypedConfigService } from "../../src/config/typed-config.service";
import { WebhookSecretCipher } from "../../src/contexts/webhooks/outbound/infrastructure/adapters/webhook-secret.cipher";
import { prisma } from "./client";
import { deterministicUuid } from "./deterministic-uuid";
import { REWARD_SEED_IDS } from "./rewards";
import { TENANT_SEED_IDS } from "./tenant-seed-ids";

// ---------------------------------------------------------------------------
// Webhooks, both ways (ADR 081 inbound, ADR 082 outbound) — development scenario.
//
// Inbound: the received-webhook log has one delivery of each kind the receiver records (a verified Billplz
// callback, a GitHub ping it ignores, a duplicate Resend event, an unsigned and a bad signature, a provider
// this server has no key for, one still processing and one whose handler failed).
//
// Outbound: Brew & Bean KL's endpoints, sealed with the app's own `WebhookSecretCipher`
// (WEBHOOK_SECRET_ENCRYPTION_KEYS): an active one in a secret rotation's grace, one that turned itself off
// after failing, and a removed one; events of several catalog types (one not yet fanned out) and a delivery in
// every status. The endpoints are on `.invalid` hosts (RFC 6761: they never resolve), so a running API that
// retries the open deliveries sends nothing anywhere: they fail at DNS, as a real broken endpoint would.
// Skipped when the key ring is not set (outgoing webhooks are off). Idempotent: upserted by id.
// ---------------------------------------------------------------------------

const NAMESPACE = "seed.webhooks";
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
/** How much longer the rotating endpoint's previous secret still signs. */
const ROTATION_GRACE_LEFT_MS = 6 * HOUR_MS;
/** When the open deliveries come due again: the retrying one in an hour, the queued test in five minutes. */
const RETRY_DUE_IN_MS = HOUR_MS;
const QUEUED_DUE_IN_MS = 5 * MINUTE_MS;
/** How long each seeded attempt took. */
const ATTEMPT_DURATION_MS = 180;
/** Endpoint versions: every change bumps it, and the rotating one was changed a few times. */
const ROTATED_ENDPOINT_VERSION = 3;
const CHANGED_ONCE_VERSION = 1;

interface SeedReceived {
	readonly key: string;
	readonly provider: ReceivedWebhookProvider;
	readonly providerDeliveryId: string | null;
	readonly eventType: string | null;
	readonly verification: ReceivedWebhookVerification;
	readonly outcome: ReceivedWebhookOutcome;
	readonly httpStatus: number | null;
	readonly minutesAgo: number;
	readonly errorSummary: string | null;
	readonly duplicates: number;
}

const RECEIVED: readonly SeedReceived[] = [
	{
		key: "billplz-paid",
		provider: "BILLPLZ",
		providerDeliveryId: "bp_paid01",
		eventType: "paid",
		verification: "VALID",
		outcome: "RECORDED",
		httpStatus: 200,
		minutesAgo: 90,
		errorSummary: null,
		duplicates: 0,
	},
	{
		key: "github-ping",
		provider: "GITHUB",
		providerDeliveryId: "0b1c2d3e-ping",
		eventType: "ping",
		verification: "VALID",
		outcome: "IGNORED",
		httpStatus: 200,
		minutesAgo: 80,
		errorSummary: null,
		duplicates: 0,
	},
	{
		key: "resend-delivered",
		provider: "RESEND",
		providerDeliveryId: "msg_2f5e1",
		eventType: "email.delivered",
		verification: "VALID",
		outcome: "DUPLICATE",
		httpStatus: 200,
		minutesAgo: 70,
		errorSummary: null,
		duplicates: 2,
	},
	{
		key: "chip-unsigned",
		provider: "CHIP",
		providerDeliveryId: null,
		eventType: null,
		verification: "MISSING",
		outcome: "REJECTED",
		httpStatus: 401,
		minutesAgo: 60,
		errorSummary: "No signature header.",
		duplicates: 0,
	},
	{
		key: "fake-bad-signature",
		provider: "FAKE_PAYMENTS",
		providerDeliveryId: "fake_42",
		eventType: "PAID",
		verification: "INVALID",
		outcome: "REJECTED",
		httpStatus: 401,
		minutesAgo: 50,
		errorSummary: "The signature does not match the body.",
		duplicates: 0,
	},
	{
		key: "twilio-no-key",
		provider: "TWILIO",
		providerDeliveryId: "SM0001",
		eventType: "delivered",
		verification: "NOT_CONFIGURED",
		outcome: "REJECTED",
		httpStatus: 503,
		minutesAgo: 40,
		errorSummary: "No Twilio auth token is configured, so the request could not be checked.",
		duplicates: 0,
	},
	{
		key: "github-processing",
		provider: "GITHUB",
		providerDeliveryId: "0b1c2d3e-push",
		eventType: "push",
		verification: "VALID",
		outcome: "PROCESSING",
		httpStatus: null,
		minutesAgo: 1,
		errorSummary: null,
		duplicates: 0,
	},
	{
		key: "resend-failed",
		provider: "RESEND",
		providerDeliveryId: "msg_9a7c3",
		eventType: "email.bounced",
		verification: "VALID",
		outcome: "FAILED",
		httpStatus: 500,
		minutesAgo: 20,
		errorSummary: "The email log could not be updated; the provider will retry.",
		duplicates: 0,
	},
];

async function seedReceivedWebhooks(now: number): Promise<number> {
	for (const delivery of RECEIVED) {
		const id = deterministicUuid(NAMESPACE, `received:${delivery.key}`);
		const receivedAt = now - delivery.minutesAgo * MINUTE_MS;
		const body = JSON.stringify({ seed: delivery.key });
		const settled = delivery.outcome !== "PROCESSING";
		const claimed = delivery.verification === "VALID";
		const row = {
			provider: delivery.provider,
			providerDeliveryId: delivery.providerDeliveryId,
			eventType: delivery.eventType,
			verification: delivery.verification,
			outcome: delivery.outcome,
			httpStatus: delivery.httpStatus,
			payloadSha256: createHash("sha256").update(body).digest("hex"),
			payloadBytes: Buffer.byteLength(body),
			headers: { "content-type": "application/json", "user-agent": `${delivery.provider.toLowerCase()}-webhooks/1` },
			correlationId: `seed-${delivery.key}`,
			errorSummary: delivery.errorSummary,
			receivedAt: BigInt(receivedAt),
			lastReceivedAt: BigInt(receivedAt + delivery.duplicates * MINUTE_MS),
			claimedAt: claimed ? BigInt(receivedAt) : null,
			completedAt: claimed && settled ? BigInt(receivedAt + 1) : null,
			attempts: 1 + delivery.duplicates,
			duplicateCount: delivery.duplicates,
			createdAt: BigInt(receivedAt),
			createdBy: `system:webhooks.inbound.${delivery.provider.toLowerCase()}`,
			updatedAt: BigInt(receivedAt + delivery.duplicates * MINUTE_MS),
			updatedBy: delivery.duplicates > 0 || settled ? `system:webhooks.inbound.${delivery.provider.toLowerCase()}` : null,
		};
		await prisma.receivedWebhook.upsert({ where: { id }, create: { id, ...row }, update: row });
	}
	return RECEIVED.length;
}

interface SeedEndpoint {
	readonly key: string;
	readonly url: string;
	readonly description: string;
	readonly eventTypes: readonly string[];
	readonly status: "ACTIVE" | "DISABLED";
	readonly disabledReason: "MANUAL" | "FAILING" | null;
	readonly consecutiveFailures: number;
	readonly daysAgo: number;
	readonly rotating: boolean;
	readonly deleted: boolean;
}

const ENDPOINTS: readonly SeedEndpoint[] = [
	{
		key: "orders",
		url: "https://orders.brew-bean.invalid/webhooks",
		description: "Order system",
		eventTypes: ["claim.redeemed", "sale.completed", "payment.succeeded", "payment.refunded"],
		status: "ACTIVE",
		disabledReason: null,
		consecutiveFailures: 1,
		daysAgo: 20,
		rotating: true,
		deleted: false,
	},
	{
		key: "crm",
		url: "https://crm.brew-bean.invalid/hooks/rewards",
		description: "Loyalty CRM",
		eventTypes: ["reward.published", "reward.rejected", "claim.created", "claim.expired"],
		status: "DISABLED",
		disabledReason: "FAILING",
		consecutiveFailures: 5,
		daysAgo: 12,
		rotating: false,
		deleted: false,
	},
	{
		key: "old-pos",
		url: "https://legacy-pos.brew-bean.invalid/in",
		description: "Old till bridge (removed)",
		eventTypes: ["sale.completed"],
		status: "DISABLED",
		disabledReason: "MANUAL",
		consecutiveFailures: 0,
		daysAgo: 40,
		rotating: false,
		deleted: true,
	},
];

interface SeedEvent {
	readonly key: string;
	readonly draft: WebhookEventDraft;
	readonly hoursAgo: number;
	readonly fannedOut: boolean;
}

function seedEvents(endpointId: string): readonly SeedEvent[] {
	const reward = REWARD_SEED_IDS.klRewardPublished;
	const claimId = REWARD_SEED_IDS.claimRedeemedKl;
	const tenantSeedIds = { reward, endpoint: endpointId };
	return [
		{
			key: "reward-published",
			draft: { type: "reward.published", data: { rewardId: tenantSeedIds.reward, title: "Free latte Fridays", via: "review" } },
			hoursAgo: 72,
			fannedOut: true,
		},
		{ key: "claim-created", draft: { type: "claim.created", data: { claimId, rewardId: tenantSeedIds.reward, isReferrerCredit: false } }, hoursAgo: 48, fannedOut: true },
		{
			key: "sale-completed",
			draft: {
				type: "sale.completed",
				data: {
					saleId: deterministicUuid(NAMESPACE, "sale"),
					locationId: TENANT_SEED_IDS.klLocation,
					terminalId: "FRONT-COUNTER-01",
					billTotalMinor: 2_850,
					currency: "MYR",
					claimIds: [claimId],
				},
			},
			hoursAgo: 24,
			fannedOut: true,
		},
		{
			key: "payment-succeeded",
			draft: {
				type: "payment.succeeded",
				data: { paymentId: deterministicUuid(NAMESPACE, "payment"), provider: "CHIP", amountMinor: 4_500, currency: "MYR", providerPaymentId: "chip_seed_01", paidAt: null },
			},
			hoursAgo: 6,
			fannedOut: true,
		},
		{
			key: "webhook-test",
			draft: { type: "webhook.test", data: { endpointId: tenantSeedIds.endpoint, message: "A test event sent from the webhook settings." } },
			hoursAgo: 2,
			fannedOut: true,
		},
		// Recorded, not fanned out yet: the sweeper takes it on its next tick (it reaches no endpoint, so it adds nothing).
		{
			key: "claim-expired",
			draft: { type: "claim.expired", data: { claimId: REWARD_SEED_IDS.claimExpiredKl, rewardId: tenantSeedIds.reward, isReferrerCredit: false } },
			hoursAgo: 0,
			fannedOut: false,
		},
	];
}

interface SeedDelivery {
	readonly key: string;
	readonly endpoint: string;
	readonly event: string;
	readonly status: WebhookDeliveryStatus;
	readonly attempts: number;
	readonly lastStatusCode: number | null;
	readonly lastError: string | null;
}

const DELIVERIES: readonly SeedDelivery[] = [
	{ key: "sale-ok", endpoint: "orders", event: "sale-completed", status: "SUCCEEDED", attempts: 1, lastStatusCode: 200, lastError: null },
	{ key: "payment-retrying", endpoint: "orders", event: "payment-succeeded", status: "FAILED", attempts: 2, lastStatusCode: 502, lastError: "HTTP 502: Bad Gateway" },
	{ key: "test-queued", endpoint: "orders", event: "webhook-test", status: "PENDING", attempts: 0, lastStatusCode: null, lastError: null },
	{ key: "reward-dead", endpoint: "crm", event: "reward-published", status: "DEAD", attempts: 10, lastStatusCode: null, lastError: "No answer within 10000 ms" },
	{
		key: "claim-cancelled",
		endpoint: "crm",
		event: "claim-created",
		status: "CANCELLED",
		attempts: 3,
		lastStatusCode: 500,
		lastError: "The endpoint was switched off or removed before this delivery was sent.",
	},
];

export interface WebhooksSeedSummary {
	readonly received: number;
	/** `skipped`: WEBHOOK_SECRET_ENCRYPTION_KEYS is not set, so outgoing webhooks are off and no secret can be sealed. */
	readonly outbound: "seeded" | "skipped";
	readonly endpoints: number;
	readonly events: number;
	readonly deliveries: number;
}

export async function seedWebhooks(now: number): Promise<WebhooksSeedSummary> {
	const received = await seedReceivedWebhooks(now);
	const cipher = new WebhookSecretCipher(new TypedConfigService(getApiConfig()));
	if (!cipher.isConfigured()) {
		return { received, outbound: "skipped", endpoints: 0, events: 0, deliveries: 0 };
	}
	const tenantId = TENANT_SEED_IDS.klTenant;
	const owner = REWARD_SEED_IDS.klOwnerUser;
	const endpointIds = new Map<string, string>();

	for (const endpoint of ENDPOINTS) {
		const id = deterministicUuid(NAMESPACE, `endpoint:${endpoint.key}`);
		endpointIds.set(endpoint.key, id);
		const createdAt = now - endpoint.daysAgo * DAY_MS;
		const current = cipher.create(id);
		const previous = endpoint.rotating ? cipher.create(id) : null;
		const disabledAt = endpoint.status === "DISABLED" ? BigInt(createdAt + DAY_MS) : null;
		const row: Omit<Prisma.WebhookEndpointUncheckedCreateInput, "id"> = {
			tenantId,
			url: endpoint.url,
			description: endpoint.description,
			eventTypes: [...endpoint.eventTypes],
			status: endpoint.status,
			disabledReason: endpoint.disabledReason,
			disabledAt,
			secretCiphertext: current.sealed.ciphertext,
			secretHint: current.sealed.hint,
			previousSecretCiphertext: previous?.sealed.ciphertext ?? null,
			// The previous secret still signs for a few more hours: the rotation's grace.
			previousSecretExpiresAt: previous === null ? null : BigInt(now + ROTATION_GRACE_LEFT_MS),
			consecutiveFailures: endpoint.consecutiveFailures,
			lastDeliveryAt: BigInt(now - HOUR_MS),
			createdByUserId: owner,
			version: endpoint.rotating ? ROTATED_ENDPOINT_VERSION : CHANGED_ONCE_VERSION,
			createdAt: BigInt(createdAt),
			createdBy: owner,
			updatedAt: BigInt(now - HOUR_MS),
			updatedBy: endpoint.disabledReason === "FAILING" ? "system:webhooks.outbound.deliver" : owner,
			isDeleted: endpoint.deleted,
			deletedAt: endpoint.deleted ? BigInt(createdAt + 2 * DAY_MS) : null,
			deletedBy: endpoint.deleted ? owner : null,
		};
		await prisma.webhookEndpoint.upsert({ where: { id }, create: { id, ...row }, update: row });
	}

	const eventIds = new Map<string, string>();
	const events = seedEvents(endpointIds.get("orders") ?? "");
	for (const event of events) {
		const id = deterministicUuid(NAMESPACE, `event:${event.key}`);
		eventIds.set(event.key, id);
		const occurredAt = BigInt(now - event.hoursAgo * HOUR_MS);
		const draft = WebhookEventDraftSchema.parse(event.draft);
		const row = {
			tenantId,
			eventType: draft.type,
			apiVersion: WEBHOOK_API_VERSION,
			payload: draft.data,
			occurredAt,
			fannedOutAt: event.fannedOut ? occurredAt + 1n : null,
			createdAt: occurredAt,
			createdBy: `system:webhooks.producer`,
			updatedAt: occurredAt,
			updatedBy: event.fannedOut ? "system:webhooks.outbound.sweep" : null,
		};
		await prisma.webhookEvent.upsert({ where: { id }, create: { id, ...row }, update: row });
	}

	for (const delivery of DELIVERIES) {
		const id = deterministicUuid(NAMESPACE, `delivery:${delivery.key}`);
		const endpointId = endpointIds.get(delivery.endpoint) ?? "";
		const eventId = eventIds.get(delivery.event) ?? "";
		const event = events.find((candidate) => candidate.key === delivery.event);
		const createdAt = now - (event?.hoursAgo ?? 0) * HOUR_MS;
		const attempted = delivery.attempts > 0;
		const row = {
			tenantId,
			endpointId,
			eventId,
			eventType: event?.draft.type ?? "webhook.test",
			status: delivery.status,
			attempts: delivery.attempts,
			// An open delivery is due again later (the retry back-off); a settled one is not due at all.
			nextAttemptAt: delivery.status === "FAILED" ? BigInt(now + RETRY_DUE_IN_MS) : delivery.status === "PENDING" ? BigInt(now + QUEUED_DUE_IN_MS) : null,
			lastAttemptAt: attempted ? BigInt(createdAt + delivery.attempts * MINUTE_MS) : null,
			lastStatusCode: delivery.lastStatusCode,
			lastError: delivery.lastError,
			lastDurationMs: attempted ? ATTEMPT_DURATION_MS : null,
			deliveredAt: delivery.status === "SUCCEEDED" ? BigInt(createdAt + MINUTE_MS) : null,
			createdAt: BigInt(createdAt),
			createdBy: "system:webhooks.outbound.sweep",
			updatedAt: BigInt(createdAt + Math.max(1, delivery.attempts) * MINUTE_MS),
			updatedBy: attempted ? "system:webhooks.outbound.deliver" : null,
		};
		await prisma.webhookDelivery.upsert({ where: { id }, create: { id, ...row }, update: row });
	}

	return { received, outbound: "seeded", endpoints: ENDPOINTS.length, events: events.length, deliveries: DELIVERIES.length };
}

import { epochMs, JsonObjectSchema, type JsonObject, WEBHOOK_API_VERSION, type EpochMs, type WebhookDeliveryStatus, type WebhookEventType } from "@workspace/shared";

import type { ActorContext } from "../../../../../../platform/application/actor-context";
import type { Clock } from "../../../../../../platform/application/clock.port";
import { TransactionalEventCollector } from "../../../../../../platform/application/events/transactional-event-collector";
import type { MerchantAccessGrant, MerchantAccessPort, MerchantAccessRequest } from "../../../../../../platform/application/ports/authorization.port";
import type { SystemOperationName } from "../../../../../../platform/application/system-operation-names";
import type { UnitOfWork } from "../../../../../../platform/application/unit-of-work.port";
import type { NotifyRequest, NotifyResult, NotifyTransactionalPort } from "../../../../../notifications/public-api";
import type { RedeemedRewardFacts, RewardOfferFacts, RewardRedemptionFacts, RewardRedemptionFactsPort } from "../../../../../rewards/public-api";
import type { ReviewNoticeFacts, ReviewNoticeFactsPort } from "../../../../../tenancy/public-api";
import { WebhookEndpoint, type WebhookEndpointState } from "../../../domain/aggregates/webhook-endpoint.aggregate";
import type { DeliveryTransition } from "../../../domain/policies/delivery-retry.policy";
import type {
	DeliveryAttemptRecord,
	NewWebhookDelivery,
	NewWebhookEvent,
	StoredWebhookDelivery,
	StoredWebhookEvent,
	WebhookDeliveryRepository,
	WebhookEndpointRepository,
	WebhookEventStore,
} from "../../../domain/repositories/webhooks.repositories";
import type { NewWebhookSecret, WebhookSecretsPort } from "../../ports/webhook-secrets.port";
import type { WebhookSendOutcome, WebhookSendRequest, WebhookSenderPort } from "../../ports/webhook-sender.port";
import type { WebhookIdGenerator } from "../../ports/webhook-ids.port";
import type { WebhooksScope } from "../../webhooks-scope";

/** A fixed instant every webhooks application test measures from. */
export const NOW: EpochMs = epochMs(1_792_195_200_000);
export const TENANT_ID = "0193f2c4-0000-7000-8000-00000000a001";
export const OTHER_TENANT_ID = "0193f2c4-0000-7000-8000-00000000a002";
export const OWNER_ID = "owner-1";
export const REWARD_ID = "0193f2c4-0000-7000-8000-00000000b001";
const LATTE_OFFER: RewardOfferFacts = { rewardType: "FREE_ITEM", rewardValue: 1, freeItem: { name: "Latte", sku: "BEV-LATTE" } };

const REQUEST = { requestId: "req-1", ip: null, userAgent: null, deviceLabel: null, endpoint: null };

export function member(userId = OWNER_ID): ActorContext {
	return { kind: "user", userId, sessionId: "session-1", tenantId: null, isSuperAdmin: false, accessScope: "tenant", impersonatorUserId: null, request: REQUEST };
}

export function apiKeyActor(): ActorContext {
	return { kind: "api_key", apiKeyId: "key-1", tenantId: TENANT_ID, locationId: null, terminalId: "TERM-1", request: REQUEST };
}

/** UUID-shaped sequential ids (`…-000000000001`, `…-000000000002`, …), as the catalog's schemas require uuids. */
export class SequentialWebhookIds implements WebhookIdGenerator {
	private issued = 0;

	public next(): string {
		this.issued += 1;
		return `0193f2c4-0000-7000-8000-${String(this.issued).padStart(12, "0")}`;
	}
}

/** A clock a test moves forward (retries come due later); the platform's `FixedClock` cannot move. */
export class AdjustableClock implements Clock {
	public constructor(public current: number = NOW) {}

	public now(): EpochMs {
		return epochMs(this.current);
	}
}

/** "Seals" a secret by tagging it with its endpoint: enough to prove the right endpoint opens the right secret. */
export class FakeWebhookSecrets implements WebhookSecretsPort {
	public configured = true;
	private count = 0;

	public isConfigured(): boolean {
		return this.configured;
	}

	public create(endpointId: string): NewWebhookSecret {
		this.count += 1;
		const plaintext = `whsec_secret${String(this.count)}`;
		return { plaintext, sealed: { ciphertext: `sealed:${endpointId}:${plaintext}`, hint: plaintext.slice(-4) } };
	}

	public open(ciphertext: string, endpointId: string): string {
		const prefix = `sealed:${endpointId}:`;
		if (!ciphertext.startsWith(prefix)) {
			throw new Error("sealed for another endpoint");
		}
		return ciphertext.slice(prefix.length);
	}
}

/** Answers each send from a script (default: a 200), and records every request. */
export class ScriptedWebhookSender implements WebhookSenderPort {
	public readonly sent: WebhookSendRequest[] = [];
	public answer: WebhookSendOutcome = { succeeded: true, statusCode: 200, error: null, durationMs: 12 };

	public send(request: WebhookSendRequest): Promise<WebhookSendOutcome> {
		this.sent.push(request);
		return Promise.resolve(this.answer);
	}
}

export const FAILED_SEND: WebhookSendOutcome = { succeeded: false, statusCode: 500, error: "HTTP 500", durationMs: 30 };

export class FakeMerchantAccess implements MerchantAccessPort {
	public readonly checks: MerchantAccessRequest[] = [];
	public denied = false;

	public assertCapability(_actor: ActorContext, request: MerchantAccessRequest): Promise<MerchantAccessGrant> {
		this.checks.push(request);
		if (this.denied) {
			return Promise.reject(new Error("forbidden"));
		}
		return Promise.resolve({ tenantId: request.tenantId, locationScope: "ALL_LOCATIONS", locationIds: [] });
	}
}

/** A `notify()` request as a test reads it: the type's key and the payload as JSON. */
export interface RecordedNotification {
	readonly typeKey: string;
	readonly recipient: NotifyRequest<object>["recipient"];
	readonly payload: JsonObject;
	readonly dedupeKey: string;
	readonly tenantId: string | null;
}

interface DeliveryRow extends StoredWebhookDelivery {
	readonly deliveredAt: EpochMs | null;
	readonly lastStatusCode: number | null;
	readonly lastError: string | null;
}

/** Every webhooks table, in memory, with the same conditional updates the Prisma repositories make. */
export class InMemoryWebhooksStore implements WebhookEndpointRepository, WebhookEventStore, RewardRedemptionFactsPort, ReviewNoticeFactsPort, NotifyTransactionalPort {
	public endpointRows = new Map<string, WebhookEndpointState>();
	public eventRows = new Map<string, StoredWebhookEvent & { readonly createdAt: EpochMs }>();
	public deliveryRows = new Map<string, DeliveryRow>();
	public rewardTenants = new Map<string, string>([[REWARD_ID, TENANT_ID]]);
	public owners: ReviewNoticeFacts | null = { slug: "sunrise", ownerUserIds: [OWNER_ID] };
	public readonly notifications: RecordedNotification[] = [];
	public readonly collector = new TransactionalEventCollector();
	public readonly deliveries: InMemoryWebhookDeliveries = new InMemoryWebhookDeliveries(this);
	public locks = 0;

	public get scope(): WebhooksScope {
		return { endpoints: this, webhookEvents: this, deliveries: this.deliveries, rewardFacts: this, tenantOwners: this, notify: this, events: this.collector };
	}

	public checkpoint(): () => void {
		const endpoints = new Map(this.endpointRows);
		const events = new Map(this.eventRows);
		const deliveries = new Map(this.deliveryRows);
		return (): void => {
			this.endpointRows = endpoints;
			this.eventRows = events;
			this.deliveryRows = deliveries;
		};
	}

	// ── endpoints ──
	public lockTenantEndpoints(): Promise<void> {
		this.locks += 1;
		return Promise.resolve();
	}

	public countLive(tenantId: string): Promise<number> {
		return Promise.resolve([...this.endpointRows.values()].filter((row) => row.tenantId === tenantId && !row.isDeleted).length);
	}

	public add(endpoint: WebhookEndpoint): Promise<void> {
		this.endpointRows.set(endpoint.id, endpoint.snapshot);
		return Promise.resolve();
	}

	public findLive(tenantId: string, endpointId: string): Promise<WebhookEndpoint | null> {
		const row = this.endpointRows.get(endpointId);
		return Promise.resolve(row === undefined || row.tenantId !== tenantId || row.isDeleted ? null : WebhookEndpoint.restore(row));
	}

	public findById(id: string): Promise<WebhookEndpoint | null> {
		const row = this.endpointRows.get(id);
		return Promise.resolve(row === undefined ? null : WebhookEndpoint.restore(row));
	}

	public save(endpoint: WebhookEndpoint): Promise<boolean> {
		const s = endpoint.snapshot;
		const current = this.endpointRows.get(s.id);
		if (current === undefined || current.version !== s.version) {
			return Promise.resolve(false);
		}
		this.endpointRows.set(s.id, { ...s, version: s.version + 1 });
		return Promise.resolve(true);
	}

	public idsReceiving(tenantId: string, type: WebhookEventType): Promise<readonly string[]> {
		return Promise.resolve(
			[...this.endpointRows.values()]
				.filter(
					(row) =>
						row.tenantId === tenantId && !row.isDeleted && row.status === "ACTIVE" && (type === "webhook.test" || row.eventTypes.some((subscribed) => subscribed === type)),
				)
				.map((row) => row.id)
				.sort(),
		);
	}

	// ── events ──
	public append(event: NewWebhookEvent): Promise<void> {
		this.eventRows.set(event.id, {
			id: event.id,
			tenantId: event.tenantId,
			eventType: event.draft.type,
			apiVersion: WEBHOOK_API_VERSION,
			payload: JsonObjectSchema.parse(event.draft.data),
			occurredAt: event.occurredAt,
			fannedOutAt: null,
			createdAt: event.occurredAt,
		});
		return Promise.resolve();
	}

	public find(eventId: string): Promise<StoredWebhookEvent | null> {
		return Promise.resolve(this.eventRows.get(eventId) ?? null);
	}

	public unfannedIdsBefore(cutoff: EpochMs, limit: number): Promise<readonly string[]> {
		return Promise.resolve(
			[...this.eventRows.values()]
				.filter((row) => row.fannedOutAt === null && row.occurredAt < cutoff)
				.slice(0, limit)
				.map((row) => row.id),
		);
	}

	public markFannedOut(eventId: string, now: EpochMs): Promise<boolean> {
		const row = this.eventRows.get(eventId);
		if (row === undefined || row.fannedOutAt !== null) {
			return Promise.resolve(false);
		}
		this.eventRows.set(eventId, { ...row, fannedOutAt: now });
		return Promise.resolve(true);
	}

	public purgeCreatedBefore(cutoff: EpochMs, limit: number): Promise<number> {
		const old = [...this.eventRows.values()].filter((row) => row.createdAt < cutoff).slice(0, limit);
		for (const row of old) {
			this.eventRows.delete(row.id);
			for (const delivery of [...this.deliveryRows.values()].filter((candidate) => candidate.eventId === row.id)) {
				this.deliveryRows.delete(delivery.id);
			}
		}
		return Promise.resolve(old.length);
	}

	// ── other contexts' ports ──
	public factsFor(rewardId: string): Promise<RewardRedemptionFacts | null> {
		const tenantId = this.rewardTenants.get(rewardId);
		if (tenantId === undefined) {
			return Promise.resolve(null);
		}
		return Promise.resolve({
			id: rewardId,
			tenantId,
			title: "Free latte",
			description: "",
			rewardType: "FREE_ITEM",
			offer: LATTE_OFFER,
			termsConditions: null,
			expiryDate: NOW,
			locationScopeType: "ALL_LOCATIONS",
			locationIds: [],
			minSpendMinor: null,
		});
	}

	public redeemedRewardsOf(): Promise<ReadonlyMap<string, RedeemedRewardFacts>> {
		return Promise.resolve(new Map<string, RedeemedRewardFacts>());
	}

	public reviewNoticeFacts(): Promise<ReviewNoticeFacts | null> {
		return Promise.resolve(this.owners);
	}

	public notify<TPayload>(request: NotifyRequest<TPayload>): Promise<NotifyResult> {
		this.notifications.push({
			typeKey: request.type.key,
			recipient: request.recipient,
			payload: request.type.declaration.toJson(request.payload),
			dedupeKey: request.dedupeKey,
			tenantId: request.tenantId,
		});
		return Promise.resolve({ duplicate: false, notificationId: `n-${String(this.notifications.length)}` });
	}

	public eventNames(): readonly string[] {
		return this.collector.take().map((event): string => event.eventName);
	}
}

/** The delivery log over the store's rows. */
export class InMemoryWebhookDeliveries implements WebhookDeliveryRepository {
	public constructor(private readonly store: InMemoryWebhooksStore) {}

	public createPending(deliveries: readonly NewWebhookDelivery[]): Promise<void> {
		for (const delivery of deliveries) {
			const duplicate = [...this.store.deliveryRows.values()].some((row) => row.endpointId === delivery.endpointId && row.eventId === delivery.eventId);
			if (!duplicate) {
				this.store.deliveryRows.set(delivery.id, {
					id: delivery.id,
					tenantId: delivery.tenantId,
					endpointId: delivery.endpointId,
					eventId: delivery.eventId,
					eventType: delivery.eventType,
					status: "PENDING",
					attempts: 0,
					nextAttemptAt: delivery.dueAt,
					deliveredAt: null,
					lastStatusCode: null,
					lastError: null,
				});
			}
		}
		return Promise.resolve();
	}

	public pendingIdsOfEvent(eventId: string): Promise<readonly string[]> {
		return Promise.resolve(
			[...this.store.deliveryRows.values()].filter((row) => row.eventId === eventId && row.status === "PENDING" && row.attempts === 0).map((row) => row.id),
		);
	}

	public findInTenant(tenantId: string, deliveryId: string): Promise<StoredWebhookDelivery | null> {
		const row = this.store.deliveryRows.get(deliveryId);
		return Promise.resolve(row === undefined || row.tenantId !== tenantId ? null : row);
	}

	public findById(deliveryId: string): Promise<StoredWebhookDelivery | null> {
		return Promise.resolve(this.store.deliveryRows.get(deliveryId) ?? null);
	}

	public delivery(deliveryId: string): DeliveryRow | undefined {
		return this.store.deliveryRows.get(deliveryId);
	}

	public claim(deliveryId: string, now: EpochMs, leaseUntil: EpochMs): Promise<boolean> {
		const row = this.store.deliveryRows.get(deliveryId);
		if (row === undefined || !isOpen(row.status) || row.nextAttemptAt === null || row.nextAttemptAt > now) {
			return Promise.resolve(false);
		}
		this.store.deliveryRows.set(deliveryId, { ...row, nextAttemptAt: leaseUntil });
		return Promise.resolve(true);
	}

	public recordAttempt(deliveryId: string, previousAttempts: number, transition: DeliveryTransition, attempt: DeliveryAttemptRecord): Promise<boolean> {
		const row = this.store.deliveryRows.get(deliveryId);
		if (row === undefined || row.attempts !== previousAttempts || !isOpen(row.status)) {
			return Promise.resolve(false);
		}
		this.store.deliveryRows.set(deliveryId, {
			...row,
			status: transition.status,
			attempts: transition.attempts,
			nextAttemptAt: transition.nextAttemptAt,
			deliveredAt: transition.deliveredAt,
			lastStatusCode: attempt.statusCode,
			lastError: attempt.error,
		});
		return Promise.resolve(true);
	}

	public cancel(deliveryId: string, reason: string): Promise<boolean> {
		const row = this.store.deliveryRows.get(deliveryId);
		if (row === undefined || !isOpen(row.status)) {
			return Promise.resolve(false);
		}
		this.store.deliveryRows.set(deliveryId, { ...row, status: "CANCELLED", nextAttemptAt: null, lastError: reason });
		return Promise.resolve(true);
	}

	public requeue(deliveryId: string, fromStatus: WebhookDeliveryStatus, now: EpochMs): Promise<boolean> {
		const row = this.store.deliveryRows.get(deliveryId);
		if (row === undefined || row.status !== fromStatus) {
			return Promise.resolve(false);
		}
		this.store.deliveryRows.set(deliveryId, { ...row, status: "PENDING", attempts: 0, nextAttemptAt: now, deliveredAt: null });
		return Promise.resolve(true);
	}

	public dueIds(now: EpochMs, limit: number): Promise<readonly string[]> {
		return Promise.resolve(
			[...this.store.deliveryRows.values()]
				.filter((row) => isOpen(row.status) && row.nextAttemptAt !== null && row.nextAttemptAt <= now)
				.slice(0, limit)
				.map((row) => row.id),
		);
	}
}

function isOpen(status: WebhookDeliveryStatus): boolean {
	return status === "PENDING" || status === "FAILED";
}

/** Runs each unit of work against the store, rolling it back on a throw. */
export class InMemoryWebhooksUnitOfWork implements UnitOfWork<WebhooksScope> {
	public readonly committed: { readonly operation: SystemOperationName | null }[] = [];

	public constructor(private readonly store: InMemoryWebhooksStore) {}

	public run<TResult>(_actor: ActorContext, work: (scope: WebhooksScope) => Promise<TResult>): Promise<TResult> {
		return this.execute(null, work);
	}

	public runSystemOperation<TResult>(operation: SystemOperationName, _actor: ActorContext, work: (scope: WebhooksScope) => Promise<TResult>): Promise<TResult> {
		return this.execute(operation, work);
	}

	private async execute<TResult>(operation: SystemOperationName | null, work: (scope: WebhooksScope) => Promise<TResult>): Promise<TResult> {
		const rollback = this.store.checkpoint();
		try {
			const result = await work(this.store.scope);
			this.committed.push({ operation });
			return result;
		} catch (error) {
			rollback();
			throw error;
		}
	}
}

/** Registers an active endpoint of `TENANT_ID` subscribed to `eventTypes`. */
export function seedEndpoint(store: InMemoryWebhooksStore, secrets: FakeWebhookSecrets, id: string, overrides: Partial<WebhookEndpointState> = {}): WebhookEndpointState {
	const endpoint = WebhookEndpoint.register(
		{
			id,
			tenantId: TENANT_ID,
			url: "https://hooks.example.com/in",
			description: "",
			eventTypes: ["claim.redeemed", "sale.completed"],
			secret: secrets.create(id).sealed,
			createdByUserId: OWNER_ID,
		},
		NOW,
	);
	const state = { ...endpoint.snapshot, ...overrides };
	store.endpointRows.set(id, state);
	return state;
}

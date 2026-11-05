import type { EpochMs, JsonObject, WebhookDeliveryStatus, WebhookEventDraft, WebhookEventType } from "@workspace/shared";

import type { WebhookEndpoint } from "../aggregates/webhook-endpoint.aggregate";
import type { DeliveryTransition } from "../policies/delivery-retry.policy";

/** The endpoint aggregate's store. Every method runs on the caller's transaction. */
export interface WebhookEndpointRepository {
	/** Serialises endpoint creation in one tenant until the transaction ends (the endpoint limit holds under races). */
	lockTenantEndpoints(tenantId: string): Promise<void>;
	countLive(tenantId: string): Promise<number>;
	add(endpoint: WebhookEndpoint): Promise<void>;
	/** A live (not removed) endpoint of the tenant. */
	findLive(tenantId: string, endpointId: string): Promise<WebhookEndpoint | null>;
	/** Any endpoint by id, removed ones too (the delivery worker, under its system operation). */
	findById(endpointId: string): Promise<WebhookEndpoint | null>;
	/** Compare-and-set on the version it was read at; `false` when someone else saved first. */
	save(endpoint: WebhookEndpoint): Promise<boolean>;
	/** The tenant's live, active endpoints subscribed to `type`. */
	idsReceiving(tenantId: string, type: WebhookEventType): Promise<readonly string[]>;
}

/** An event as the producer records it: the catalog draft, its tenant, id and time. */
export interface NewWebhookEvent {
	readonly id: string;
	readonly tenantId: string;
	readonly draft: WebhookEventDraft;
	readonly occurredAt: EpochMs;
}

/** An event as stored. `payload` is re-validated against the catalog before it is sent. */
export interface StoredWebhookEvent {
	readonly id: string;
	readonly tenantId: string;
	readonly eventType: string;
	readonly apiVersion: string;
	readonly payload: JsonObject;
	readonly occurredAt: EpochMs;
	readonly fannedOutAt: EpochMs | null;
}

/** The event outbox. `append` works in any session (append-only RLS); the rest under the webhooks system operations. */
export interface WebhookEventStore {
	append(event: NewWebhookEvent): Promise<void>;
	find(eventId: string): Promise<StoredWebhookEvent | null>;
	/** Events not fanned out yet that happened before `cutoff`, oldest first. */
	unfannedIdsBefore(cutoff: EpochMs, limit: number): Promise<readonly string[]>;
	/** `false` when another fan-out stamped it first. */
	markFannedOut(eventId: string, now: EpochMs): Promise<boolean>;
	/** Deletes up to `limit` events created before `cutoff` (their deliveries go with them); returns how many. */
	purgeCreatedBefore(cutoff: EpochMs, limit: number): Promise<number>;
}

export interface NewWebhookDelivery {
	readonly id: string;
	readonly tenantId: string;
	readonly endpointId: string;
	readonly eventId: string;
	readonly eventType: WebhookEventType;
	/** When the first attempt is due. */
	readonly dueAt: EpochMs;
}

export interface StoredWebhookDelivery {
	readonly id: string;
	readonly tenantId: string;
	readonly endpointId: string;
	readonly eventId: string;
	readonly eventType: string;
	readonly status: WebhookDeliveryStatus;
	readonly attempts: number;
	readonly nextAttemptAt: EpochMs | null;
}

/** What one attempt saw, recorded with its transition. */
export interface DeliveryAttemptRecord {
	readonly at: EpochMs;
	readonly statusCode: number | null;
	readonly error: string | null;
	readonly durationMs: number;
}

/** The delivery log. Every transition is a conditional update, so a repeated job or a second sweeper changes nothing. */
export interface WebhookDeliveryRepository {
	/** Creates the deliveries that do not exist yet (one per endpoint and event). */
	createPending(deliveries: readonly NewWebhookDelivery[]): Promise<void>;
	/** The ids of an event's deliveries that are waiting to be sent. */
	pendingIdsOfEvent(eventId: string): Promise<readonly string[]>;
	findInTenant(tenantId: string, deliveryId: string): Promise<StoredWebhookDelivery | null>;
	findById(deliveryId: string): Promise<StoredWebhookDelivery | null>;
	/** Takes a due delivery for one attempt: pushes `nextAttemptAt` to `leaseUntil`. `false` when it is not due or someone else took it. */
	claim(deliveryId: string, now: EpochMs, leaseUntil: EpochMs): Promise<boolean>;
	/** Records an attempt's transition, if the delivery is still at `previousAttempts` and still open. */
	recordAttempt(deliveryId: string, previousAttempts: number, transition: DeliveryTransition, attempt: DeliveryAttemptRecord): Promise<boolean>;
	/** Settles an open delivery as CANCELLED (its endpoint is off or gone). */
	cancel(deliveryId: string, reason: string, now: EpochMs): Promise<boolean>;
	/** Queues a settled delivery again from attempt one, if it is still in `fromStatus`. */
	requeue(deliveryId: string, fromStatus: WebhookDeliveryStatus, now: EpochMs): Promise<boolean>;
	/** Open deliveries whose next attempt is due, oldest due first. */
	dueIds(now: EpochMs, limit: number): Promise<readonly string[]>;
}

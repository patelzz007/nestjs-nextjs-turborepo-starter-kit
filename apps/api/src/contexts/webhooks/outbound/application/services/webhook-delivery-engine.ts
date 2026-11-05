import { CaughtValueSchema, epochMs, WebhookEventEnvelopeSchema, WebhookEventTypeSchema, type EpochMs } from "@workspace/shared";
import { Logger } from "@nestjs/common";

import { systemActor, type ActorContext } from "../../../../../platform/application/actor-context";
import type { Clock } from "../../../../../platform/application/clock.port";
import { caughtErrorLogFields } from "../../../../../platform/application/errors/caught-error-log";
import type { SystemOperationName } from "../../../../../platform/application/system-operation-names";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { WEBHOOK_ENDPOINT_AUTO_DISABLED_NOTIFICATION } from "../../../../notifications/public-api";
import type { WebhookEndpoint } from "../../domain/aggregates/webhook-endpoint.aggregate";
import { WebhookEndpointAutoDisabled } from "../../domain/events/webhook.events";
import { nextDeliveryState, WEBHOOK_DELIVERY_RETRY_POLICY, type DeliveryRetryPolicy, type DeliveryTransition } from "../../domain/policies/delivery-retry.policy";
import { signingTimestamp, webhookDeliveryHeaders } from "../../domain/policies/webhook-signature.policy";
import type { StoredWebhookDelivery } from "../../domain/repositories/webhooks.repositories";
import type { WebhookIdGenerator } from "../ports/webhook-ids.port";
import type { WebhookSecretsPort } from "../ports/webhook-secrets.port";
import type { WebhookSenderPort } from "../ports/webhook-sender.port";
import { WEBHOOKS_DELIVER_OPERATION, WEBHOOKS_RETENTION_OPERATION, WEBHOOKS_SWEEP_OPERATION } from "../ports/webhooks-outbound.tokens";
import type { WebhooksScope } from "../webhooks-scope";

const MS_PER_SECOND = 1_000;
const MS_PER_DAY = 86_400_000;

/** How long one attempt holds its delivery: longer than the send deadline, so no second worker sends it meanwhile. */
export const WEBHOOK_DELIVERY_LEASE_MS = 60 * MS_PER_SECOND;
/** An event is fanned out at once after its commit; the sweeper only takes the ones still waiting after this. */
export const WEBHOOK_FAN_OUT_GRACE_MS = 30 * MS_PER_SECOND;
/** Events (and their delivery log) are kept this long, then purged (ADR 082). */
export const WEBHOOK_EVENT_RETENTION_MS = 30 * MS_PER_DAY;
/** Rows one sweep or one purge round takes at most. */
export const WEBHOOK_SWEEP_BATCH = 100;
/** Deliveries sent at the same time by one sweep. */
export const WEBHOOK_SEND_CONCURRENCY = 8;
/** Compare-and-set retries of an endpoint's failure count against a concurrent member change. */
const ENDPOINT_SAVE_ATTEMPTS = 3;

/** What one call to {@link WebhookDeliveryEngine.deliver} did. */
export type DeliveryRun = "sent" | "skipped" | "cancelled";

export interface SweepResult {
	readonly fannedOut: number;
	readonly attempted: number;
}

export interface WebhookDeliveryEngineDeps {
	readonly uow: UnitOfWork<WebhooksScope>;
	readonly secrets: WebhookSecretsPort;
	readonly sender: WebhookSenderPort;
	readonly ids: WebhookIdGenerator;
	readonly clock: Clock;
	readonly random: () => number;
	readonly policy?: DeliveryRetryPolicy;
}

/** A delivery ready to send: the signed request, and what it was read at. */
interface PreparedDelivery {
	readonly delivery: StoredWebhookDelivery;
	readonly url: string;
	readonly body: string;
	readonly headers: Readonly<Record<string, string>>;
}

type Preparation = { readonly kind: "send"; readonly prepared: PreparedDelivery } | { readonly kind: "skipped" } | { readonly kind: "cancelled" };

/**
 * The outgoing webhook pipeline (ADR 082), under the webhooks' system operations:
 *
 * 1. **Fan-out**: an event becomes one PENDING delivery per active endpoint of its tenant subscribed to its type.
 * 2. **Deliver**: a due delivery is claimed (a lease, so one worker sends it), signed with the endpoint's
 *    current (and, in a rotation's grace, previous) secret, POSTed OUTSIDE any transaction, and its outcome
 *    recorded as a conditional transition: SUCCEEDED, FAILED with the next attempt's time, or DEAD.
 * 3. **Endpoint health**: a success resets the endpoint's failure streak, a DEAD delivery extends it, and at the
 *    threshold the endpoint turns itself off and its owners are told (in the same transaction).
 *
 * Every step is idempotent: a repeated after-commit handler, a second sweeper on another instance or a retried
 * job changes nothing that already happened.
 */
export class WebhookDeliveryEngine {
	private readonly logger: Logger = new Logger(WebhookDeliveryEngine.name);
	private readonly policy: DeliveryRetryPolicy;

	public constructor(private readonly deps: WebhookDeliveryEngineDeps) {
		this.policy = deps.policy ?? WEBHOOK_DELIVERY_RETRY_POLICY;
	}

	/** Fans one event out (once) and answers the ids of its deliveries still waiting for their first attempt. */
	public async fanOut(eventId: string, tenantId: string | null): Promise<readonly string[]> {
		const now = epochMs(this.deps.clock.now());
		return this.deps.uow.runSystemOperation(WEBHOOKS_SWEEP_OPERATION, this.actor(WEBHOOKS_SWEEP_OPERATION, tenantId, "Fan an outgoing webhook event out"), async (scope) => {
			const event = await scope.webhookEvents.find(eventId);
			if (event === null) {
				return [];
			}
			if (event.fannedOutAt === null) {
				const type = WebhookEventTypeSchema.parse(event.eventType);
				// A test event has exactly one delivery, created by the member's request: it is never fanned out.
				const receivers = type === "webhook.test" ? [] : await scope.endpoints.idsReceiving(event.tenantId, type);
				await scope.deliveries.createPending(
					receivers.map((endpointId: string) => ({ id: this.deps.ids.next(), tenantId: event.tenantId, endpointId, eventId: event.id, eventType: type, dueAt: now })),
				);
				await scope.webhookEvents.markFannedOut(event.id, now);
			}
			return scope.deliveries.pendingIdsOfEvent(event.id);
		});
	}

	/** Makes one attempt at a delivery, if it is due and nobody else holds it. Never rejects for the endpoint's sake. */
	public async deliver(deliveryId: string, tenantId: string | null): Promise<DeliveryRun> {
		const actor = this.actor(WEBHOOKS_DELIVER_OPERATION, tenantId, "Send an outgoing webhook delivery");
		const preparation = await this.deps.uow.runSystemOperation(WEBHOOKS_DELIVER_OPERATION, actor, (scope) => this.prepare(scope, deliveryId));
		if (preparation.kind !== "send") {
			return preparation.kind;
		}
		const { prepared } = preparation;
		// The network call is outside every transaction: a slow endpoint never holds a database connection.
		const outcome = await this.deps.sender.send({ url: prepared.url, body: prepared.body, headers: prepared.headers });
		const at = epochMs(this.deps.clock.now());
		const transition = nextDeliveryState(prepared.delivery.attempts, outcome.succeeded, at, this.policy, this.deps.random);
		await this.deps.uow.runSystemOperation(WEBHOOKS_DELIVER_OPERATION, actor, async (scope) => {
			const recorded = await scope.deliveries.recordAttempt(prepared.delivery.id, prepared.delivery.attempts, transition, {
				at,
				statusCode: outcome.statusCode,
				error: outcome.error,
				durationMs: outcome.durationMs,
			});
			if (recorded && transition.status !== "FAILED") {
				await this.recordEndpointHealth(scope, prepared.delivery.endpointId, transition, at);
			}
		});
		return "sent";
	}

	/** One sweep: events that missed their immediate fan-out, then every delivery that is due. */
	public async sweepOnce(): Promise<SweepResult> {
		const now = epochMs(this.deps.clock.now());
		const actor = this.actor(WEBHOOKS_SWEEP_OPERATION, null, "Sweep outgoing webhooks");
		const unfanned = await this.deps.uow.runSystemOperation(WEBHOOKS_SWEEP_OPERATION, actor, (scope) =>
			scope.webhookEvents.unfannedIdsBefore(epochMs(now - WEBHOOK_FAN_OUT_GRACE_MS), WEBHOOK_SWEEP_BATCH),
		);
		for (const eventId of unfanned) {
			await this.fanOut(eventId, null);
		}
		const due = await this.deps.uow.runSystemOperation(WEBHOOKS_SWEEP_OPERATION, actor, (scope) => scope.deliveries.dueIds(now, WEBHOOK_SWEEP_BATCH));
		for (let start = 0; start < due.length; start += WEBHOOK_SEND_CONCURRENCY) {
			await Promise.all(due.slice(start, start + WEBHOOK_SEND_CONCURRENCY).map((deliveryId: string) => this.deliverSafely(deliveryId)));
		}
		return { fannedOut: unfanned.length, attempted: due.length };
	}

	/** Deletes events past the retention window (their deliveries go with them); answers how many. */
	public async purgeExpired(): Promise<number> {
		const cutoff = epochMs(this.deps.clock.now() - WEBHOOK_EVENT_RETENTION_MS);
		const actor = this.actor(WEBHOOKS_RETENTION_OPERATION, null, "Purge outgoing webhook events past their retention");
		let purged = 0;
		let round = 0;
		do {
			round = await this.deps.uow.runSystemOperation(WEBHOOKS_RETENTION_OPERATION, actor, (scope) => scope.webhookEvents.purgeCreatedBefore(cutoff, WEBHOOK_SWEEP_BATCH));
			purged += round;
		} while (round === WEBHOOK_SWEEP_BATCH);
		return purged;
	}

	/** {@link deliver} for a background caller: a failure is logged, and the delivery is picked up again later. */
	public async deliverSafely(deliveryId: string, tenantId: string | null = null): Promise<DeliveryRun | null> {
		try {
			return await this.deliver(deliveryId, tenantId);
		} catch (error) {
			this.logger.error({ event: "webhooks.outbound.deliver_failed", deliveryId, ...caughtErrorLogFields(CaughtValueSchema.safeParse(error).data) });
			return null;
		}
	}

	private async prepare(scope: WebhooksScope, deliveryId: string): Promise<Preparation> {
		const now = epochMs(this.deps.clock.now());
		const delivery = await scope.deliveries.findById(deliveryId);
		if (delivery === null || !(await scope.deliveries.claim(deliveryId, now, epochMs(now + WEBHOOK_DELIVERY_LEASE_MS)))) {
			return { kind: "skipped" };
		}
		const endpoint = await scope.endpoints.findById(delivery.endpointId);
		if (endpoint === null || !endpoint.isActive) {
			await scope.deliveries.cancel(deliveryId, "The endpoint was switched off or removed before this delivery was sent.", now);
			return { kind: "cancelled" };
		}
		const event = await scope.webhookEvents.find(delivery.eventId);
		if (event === null) {
			await scope.deliveries.cancel(deliveryId, "The event is no longer kept.", now);
			return { kind: "cancelled" };
		}
		// Re-validated against the public catalog: nothing leaves the platform that the catalog does not describe.
		const envelope = WebhookEventEnvelopeSchema.parse({
			id: event.id,
			apiVersion: event.apiVersion,
			createdAt: event.occurredAt,
			tenantId: event.tenantId,
			type: event.eventType,
			data: event.payload,
		});
		const body = JSON.stringify(envelope);
		const secrets = endpoint.signingSecretCiphertexts(now).map((ciphertext: string): string => this.deps.secrets.open(ciphertext, endpoint.id));
		const headers = webhookDeliveryHeaders({ deliveryId, secrets, timestamp: signingTimestamp(now), body });
		return { kind: "send", prepared: { delivery, url: endpoint.snapshot.url, body, headers } };
	}

	/** Moves the endpoint's failure streak (compare-and-set, retried against a concurrent member change). */
	private async recordEndpointHealth(scope: WebhooksScope, endpointId: string, transition: DeliveryTransition, at: EpochMs): Promise<void> {
		for (let attempt = 0; attempt < ENDPOINT_SAVE_ATTEMPTS; attempt += 1) {
			const endpoint = await scope.endpoints.findById(endpointId);
			if (endpoint === null) {
				return;
			}
			if (transition.status === "SUCCEEDED") {
				endpoint.recordDeliverySucceeded(at);
			} else {
				endpoint.recordDeliveryDead(at);
			}
			if (await scope.endpoints.save(endpoint)) {
				await this.tellOwnersIfTurnedOff(scope, endpoint);
				return;
			}
		}
		this.logger.warn({ event: "webhooks.outbound.endpoint_health_conflict", endpointId });
	}

	private async tellOwnersIfTurnedOff(scope: WebhooksScope, endpoint: WebhookEndpoint): Promise<void> {
		for (const event of endpoint.pullEvents()) {
			if (!(event instanceof WebhookEndpointAutoDisabled)) {
				continue;
			}
			const facts = await scope.tenantOwners.reviewNoticeFacts(event.tenantId);
			if (facts === null) {
				return;
			}
			for (const userId of facts.ownerUserIds) {
				await scope.notify.notify({
					type: WEBHOOK_ENDPOINT_AUTO_DISABLED_NOTIFICATION,
					recipient: { kind: "user", userId },
					payload: { endpointId: event.endpointId, endpointUrl: event.url, tenantSlug: facts.slug, consecutiveFailures: event.consecutiveFailures },
					dedupeKey: `webhook-endpoint-auto-disabled:${event.endpointId}:${String(event.occurredAt)}`,
					tenantId: event.tenantId,
				});
			}
			this.logger.warn({ event: "webhooks.outbound.endpoint_auto_disabled", endpointId: event.endpointId, tenantId: event.tenantId });
		}
	}

	private actor(operation: SystemOperationName, tenantId: string | null, reason: string): ActorContext {
		return systemActor(operation, "job", tenantId, reason, null);
	}
}

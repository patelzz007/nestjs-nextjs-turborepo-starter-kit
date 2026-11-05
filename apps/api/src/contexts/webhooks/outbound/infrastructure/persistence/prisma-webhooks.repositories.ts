import type { Prisma } from "@prisma/client";
import {
	epochMs,
	JsonObjectSchema,
	WEBHOOK_API_VERSION,
	WebhookEndpointEventTypesSchema,
	type EpochMs,
	type WebhookDeliveryStatus,
	type WebhookEventType,
} from "@workspace/shared";

import { WebhookEndpoint, type WebhookEndpointState } from "../../domain/aggregates/webhook-endpoint.aggregate";
import type { DeliveryTransition } from "../../domain/policies/delivery-retry.policy";
import type {
	DeliveryAttemptRecord,
	NewWebhookDelivery,
	NewWebhookEvent,
	StoredWebhookDelivery,
	StoredWebhookEvent,
	WebhookDeliveryRepository,
	WebhookEndpointRepository,
	WebhookEventStore,
} from "../../domain/repositories/webhooks.repositories";

type EndpointRow = Prisma.WebhookEndpointGetPayload<Prisma.WebhookEndpointDefaultArgs>;
type DeliveryRow = Prisma.WebhookDeliveryGetPayload<Prisma.WebhookDeliveryDefaultArgs>;

const LIVE = { isDeleted: false } satisfies { isDeleted: boolean };
/** The statuses a delivery can still be sent in. */
const OPEN_STATUSES: readonly WebhookDeliveryStatus[] = ["PENDING", "FAILED"];

function epochOrNull(value: bigint | null): EpochMs | null {
	return value === null ? null : epochMs(Number(value));
}

function bigintOrNull(value: number | null): bigint | null {
	return value === null ? null : BigInt(value);
}

export function webhookEndpointOf(row: EndpointRow): WebhookEndpoint {
	const state: WebhookEndpointState = {
		id: row.id,
		tenantId: row.tenantId,
		url: row.url,
		description: row.description,
		eventTypes: WebhookEndpointEventTypesSchema.parse(row.eventTypes),
		status: row.status,
		disabledReason: row.disabledReason,
		disabledAt: epochOrNull(row.disabledAt),
		secret: { ciphertext: row.secretCiphertext, hint: row.secretHint },
		previousSecretCiphertext: row.previousSecretCiphertext,
		previousSecretExpiresAt: epochOrNull(row.previousSecretExpiresAt),
		consecutiveFailures: row.consecutiveFailures,
		lastDeliveryAt: epochOrNull(row.lastDeliveryAt),
		createdByUserId: row.createdByUserId,
		version: row.version,
		createdAt: epochMs(Number(row.createdAt)),
		updatedAt: epochMs(Number(row.updatedAt)),
		isDeleted: row.isDeleted,
		deletedAt: epochOrNull(row.deletedAt),
	};
	return WebhookEndpoint.restore(state);
}

/** Endpoints, under the member's session (tenant RLS) or the webhooks' system operations. */
export class PrismaWebhookEndpointRepository implements WebhookEndpointRepository {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async lockTenantEndpoints(tenantId: string): Promise<void> {
		const lockKey = `webhook-endpoints:${tenantId}`;
		await this.db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
	}

	public countLive(tenantId: string): Promise<number> {
		return this.db.webhookEndpoint.count({ where: { tenantId, ...LIVE } });
	}

	public async add(endpoint: WebhookEndpoint): Promise<void> {
		const s = endpoint.snapshot;
		await this.db.webhookEndpoint.createMany({
			data: [
				{
					id: s.id,
					tenantId: s.tenantId,
					url: s.url,
					description: s.description,
					eventTypes: [...s.eventTypes],
					status: s.status,
					secretCiphertext: s.secret.ciphertext,
					secretHint: s.secret.hint,
					createdByUserId: s.createdByUserId,
					version: s.version,
					createdAt: BigInt(s.createdAt),
					updatedAt: BigInt(s.updatedAt),
				},
			],
		});
	}

	public async findLive(tenantId: string, endpointId: string): Promise<WebhookEndpoint | null> {
		const row = await this.db.webhookEndpoint.findFirst({ where: { id: endpointId, tenantId, ...LIVE } });
		return row === null ? null : webhookEndpointOf(row);
	}

	public async findById(endpointId: string): Promise<WebhookEndpoint | null> {
		const row = await this.db.webhookEndpoint.findUnique({ where: { id: endpointId } });
		return row === null ? null : webhookEndpointOf(row);
	}

	public async save(endpoint: WebhookEndpoint): Promise<boolean> {
		const s = endpoint.snapshot;
		const result = await this.db.webhookEndpoint.updateMany({
			where: { id: s.id, version: s.version },
			data: {
				url: s.url,
				description: s.description,
				eventTypes: [...s.eventTypes],
				status: s.status,
				disabledReason: s.disabledReason,
				disabledAt: bigintOrNull(s.disabledAt),
				secretCiphertext: s.secret.ciphertext,
				secretHint: s.secret.hint,
				previousSecretCiphertext: s.previousSecretCiphertext,
				previousSecretExpiresAt: bigintOrNull(s.previousSecretExpiresAt),
				consecutiveFailures: s.consecutiveFailures,
				lastDeliveryAt: bigintOrNull(s.lastDeliveryAt),
				isDeleted: s.isDeleted,
				deletedAt: bigintOrNull(s.deletedAt),
				updatedAt: BigInt(s.updatedAt),
				version: { increment: 1 },
			},
		});
		return result.count === 1;
	}

	public async idsReceiving(tenantId: string, type: WebhookEventType): Promise<readonly string[]> {
		const subscribed = type === "webhook.test" ? {} : { eventTypes: { has: type } };
		const rows = await this.db.webhookEndpoint.findMany({ where: { tenantId, ...LIVE, status: "ACTIVE", ...subscribed }, select: { id: true }, orderBy: { id: "asc" } });
		return rows.map((row): string => row.id);
	}
}

/** The event outbox. `append` writes without reading back (the producer's session may not SELECT events). */
export class PrismaWebhookEventStore implements WebhookEventStore {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async append(event: NewWebhookEvent): Promise<void> {
		await this.db.webhookEvent.createMany({
			data: [
				{
					id: event.id,
					tenantId: event.tenantId,
					eventType: event.draft.type,
					apiVersion: WEBHOOK_API_VERSION,
					payload: JsonObjectSchema.parse(event.draft.data),
					occurredAt: BigInt(event.occurredAt),
					createdAt: BigInt(event.occurredAt),
					updatedAt: BigInt(event.occurredAt),
				},
			],
		});
	}

	public async find(eventId: string): Promise<StoredWebhookEvent | null> {
		const row = await this.db.webhookEvent.findUnique({ where: { id: eventId } });
		if (row === null) {
			return null;
		}
		return {
			id: row.id,
			tenantId: row.tenantId,
			eventType: row.eventType,
			apiVersion: row.apiVersion,
			payload: JsonObjectSchema.parse(row.payload),
			occurredAt: epochMs(Number(row.occurredAt)),
			fannedOutAt: epochOrNull(row.fannedOutAt),
		};
	}

	public async unfannedIdsBefore(cutoff: EpochMs, limit: number): Promise<readonly string[]> {
		const rows = await this.db.webhookEvent.findMany({
			where: { fannedOutAt: null, occurredAt: { lt: BigInt(cutoff) } },
			select: { id: true },
			orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
			take: limit,
		});
		return rows.map((row): string => row.id);
	}

	public async markFannedOut(eventId: string, now: EpochMs): Promise<boolean> {
		const result = await this.db.webhookEvent.updateMany({ where: { id: eventId, fannedOutAt: null }, data: { fannedOutAt: BigInt(now) } });
		return result.count === 1;
	}

	public async purgeCreatedBefore(cutoff: EpochMs, limit: number): Promise<number> {
		const rows = await this.db.webhookEvent.findMany({ where: { createdAt: { lt: BigInt(cutoff) } }, select: { id: true }, orderBy: { createdAt: "asc" }, take: limit });
		if (rows.length === 0) {
			return 0;
		}
		// Deliveries reference their event (ON DELETE CASCADE): the log goes with the event it delivered.
		const result = await this.db.webhookEvent.deleteMany({ where: { id: { in: rows.map((row): string => row.id) } } });
		return result.count;
	}
}

function storedDeliveryOf(row: DeliveryRow): StoredWebhookDelivery {
	return {
		id: row.id,
		tenantId: row.tenantId,
		endpointId: row.endpointId,
		eventId: row.eventId,
		eventType: row.eventType,
		status: row.status,
		attempts: row.attempts,
		nextAttemptAt: epochOrNull(row.nextAttemptAt),
	};
}

/** The delivery log. Every transition is conditional on the state it was read in. */
export class PrismaWebhookDeliveryRepository implements WebhookDeliveryRepository {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async createPending(deliveries: readonly NewWebhookDelivery[]): Promise<void> {
		if (deliveries.length === 0) {
			return;
		}
		await this.db.webhookDelivery.createMany({
			data: deliveries.map((delivery): Prisma.WebhookDeliveryCreateManyInput => ({
				id: delivery.id,
				tenantId: delivery.tenantId,
				endpointId: delivery.endpointId,
				eventId: delivery.eventId,
				eventType: delivery.eventType,
				status: "PENDING",
				nextAttemptAt: BigInt(delivery.dueAt),
				createdAt: BigInt(delivery.dueAt),
				updatedAt: BigInt(delivery.dueAt),
			})),
			// One delivery per endpoint and event: a second fan-out of the same event adds nothing.
			skipDuplicates: true,
		});
	}

	public async pendingIdsOfEvent(eventId: string): Promise<readonly string[]> {
		const rows = await this.db.webhookDelivery.findMany({ where: { eventId, status: "PENDING", attempts: 0 }, select: { id: true }, orderBy: { id: "asc" } });
		return rows.map((row): string => row.id);
	}

	public async findInTenant(tenantId: string, deliveryId: string): Promise<StoredWebhookDelivery | null> {
		const row = await this.db.webhookDelivery.findFirst({ where: { id: deliveryId, tenantId, ...LIVE } });
		return row === null ? null : storedDeliveryOf(row);
	}

	public async findById(deliveryId: string): Promise<StoredWebhookDelivery | null> {
		const row = await this.db.webhookDelivery.findUnique({ where: { id: deliveryId } });
		return row === null ? null : storedDeliveryOf(row);
	}

	public async claim(deliveryId: string, now: EpochMs, leaseUntil: EpochMs): Promise<boolean> {
		const result = await this.db.webhookDelivery.updateMany({
			where: { id: deliveryId, status: { in: [...OPEN_STATUSES] }, nextAttemptAt: { lte: BigInt(now) } },
			data: { nextAttemptAt: BigInt(leaseUntil), updatedAt: BigInt(now) },
		});
		return result.count === 1;
	}

	public async recordAttempt(deliveryId: string, previousAttempts: number, transition: DeliveryTransition, attempt: DeliveryAttemptRecord): Promise<boolean> {
		const result = await this.db.webhookDelivery.updateMany({
			where: { id: deliveryId, attempts: previousAttempts, status: { in: [...OPEN_STATUSES] } },
			data: {
				status: transition.status,
				attempts: transition.attempts,
				nextAttemptAt: bigintOrNull(transition.nextAttemptAt),
				deliveredAt: bigintOrNull(transition.deliveredAt),
				lastAttemptAt: BigInt(attempt.at),
				lastStatusCode: attempt.statusCode,
				lastError: attempt.error,
				lastDurationMs: attempt.durationMs,
				updatedAt: BigInt(attempt.at),
			},
		});
		return result.count === 1;
	}

	public async cancel(deliveryId: string, reason: string, now: EpochMs): Promise<boolean> {
		const result = await this.db.webhookDelivery.updateMany({
			where: { id: deliveryId, status: { in: [...OPEN_STATUSES] } },
			data: { status: "CANCELLED", nextAttemptAt: null, lastError: reason, updatedAt: BigInt(now) },
		});
		return result.count === 1;
	}

	public async requeue(deliveryId: string, fromStatus: WebhookDeliveryStatus, now: EpochMs): Promise<boolean> {
		const result = await this.db.webhookDelivery.updateMany({
			where: { id: deliveryId, status: fromStatus },
			data: { status: "PENDING", attempts: 0, nextAttemptAt: BigInt(now), deliveredAt: null, updatedAt: BigInt(now) },
		});
		return result.count === 1;
	}

	public async dueIds(now: EpochMs, limit: number): Promise<readonly string[]> {
		const rows = await this.db.webhookDelivery.findMany({
			where: { status: { in: [...OPEN_STATUSES] }, nextAttemptAt: { lte: BigInt(now) } },
			select: { id: true },
			orderBy: [{ nextAttemptAt: "asc" }, { id: "asc" }],
			take: limit,
		});
		return rows.map((row): string => row.id);
	}
}

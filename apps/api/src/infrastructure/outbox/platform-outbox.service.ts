import { randomUUID } from "node:crypto";

import { Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import {
	JsonObjectSchema,
	PLATFORM_EVENT_TOPICS,
	PlatformEventEnvelopeSchema,
	PlatformEventInputSchema,
	nowEpochMs,
	type PlatformEventEnvelope,
	type PlatformEventId,
	type PlatformEventInput,
} from "@workspace/shared";

import { RequestContextService } from "../../common/context/request-context";
import { TenantTransactionService } from "../../prisma/tenant-transaction.service";

/** Allowlisted system operation (system-operation.registry.ts) for events with no domain write. */
export const OUTBOX_ENQUEUE_OPERATION = "outbox.enqueue";

/**
 * Column bounds of `outbox_events` (schema.prisma). Values are clamped so an
 * over-long client-supplied `X-Correlation-Id` can never fail the event insert —
 * which would roll back the caller's domain transaction with it.
 */
const OUTBOX_CORRELATION_ID_MAX_LENGTH = 64;
const OUTBOX_PARTITION_KEY_MAX_LENGTH = 255;

/**
 * The one capability the outbox needs from the caller's transaction. Satisfied
 * by a Prisma interactive-transaction client (`prisma.$transaction(tx => …)`,
 * `TenantTransactionService.withTenantTransaction/withSystemOperation`).
 *
 * `createMany` (not `create`) on purpose: it issues a plain INSERT with no
 * `RETURNING`, so it needs only the append-only RLS policy on `outbox_events`
 * and works under the caller's user/tenant-scoped session. The event id is
 * assigned here, by the producer, not read back from the database.
 */
export interface OutboxTransaction {
	readonly outboxEvent: {
		createMany(args: { data: Prisma.OutboxEventCreateManyInput[] }): PromiseLike<{ readonly count: number }>;
	};
}

/** Outcome of {@link PlatformOutboxService.recordTelemetry} — it never throws. */
export type TelemetryRecordResult = { readonly recorded: true; readonly eventId: PlatformEventId } | { readonly recorded: false; readonly error: string };

/** The insert affected an unexpected number of rows — the event is NOT recorded. */
export class OutboxEnqueueError extends Error {
	public constructor(
		public readonly eventId: PlatformEventId,
		public readonly insertedCount: number,
	) {
		super(`Outbox insert for event ${eventId} affected ${String(insertedCount)} row(s), expected 1`);
		this.name = "OutboxEnqueueError";
	}
}

/**
 * Producer side of the transactional outbox.
 *
 * - {@link enqueueInTransaction} — the default: write the event in the SAME
 *   transaction as the domain change it describes. Commit ⇒ event exists;
 *   rollback ⇒ event never existed.
 * - {@link recordTelemetry} — only for events that describe NO database write
 *   (e.g. "refresh rejected", auth-flow outcome telemetry). Opens its own short
 *   transaction under the `outbox.enqueue` system operation and awaits it. A
 *   failure is logged (`outbox.telemetry_record_failed`) and returned as a
 *   typed result so it can never mask the caller's own outcome.
 *
 * There is deliberately no fire-and-forget path: every write is awaited.
 */
@Injectable()
export class PlatformOutboxService {
	private readonly logger: Logger = new Logger(PlatformOutboxService.name);

	public constructor(
		private readonly transactions: TenantTransactionService,
		private readonly requestContext: RequestContextService,
	) {}

	/** Append `input` to the outbox inside the caller's open transaction. Returns the stable event id. */
	public async enqueueInTransaction(tx: OutboxTransaction, input: PlatformEventInput): Promise<PlatformEventId> {
		const row = this.buildRow(input);
		const result = await tx.outboxEvent.createMany({ data: [row] });
		if (result.count !== 1) {
			throw new OutboxEnqueueError(row.id, result.count);
		}
		this.logger.debug({ event: "outbox.enqueued", eventId: row.id, eventType: row.eventType, topic: row.topic, correlationId: row.correlationId });
		return row.id;
	}

	/**
	 * Record an event that has no domain write to be atomic with, in its own
	 * awaited transaction (`outbox.enqueue` system operation). Never throws:
	 * a failed write is logged and reported in the result, because telemetry
	 * must not replace the caller's real outcome (e.g. a 401) with a 500.
	 */
	public async recordTelemetry(input: PlatformEventInput): Promise<TelemetryRecordResult> {
		const correlationId = this.requestContext.correlationId() ?? randomUUID();
		try {
			const eventId = await this.transactions.withSystemOperation(
				{ operation: OUTBOX_ENQUEUE_OPERATION, reason: `platform_event:${input.type}`, correlationId, actorUserId: null },
				async (tx): Promise<PlatformEventId> => this.enqueueInTransaction(tx, input),
			);
			return { recorded: true, eventId };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.logger.error({ event: "outbox.telemetry_record_failed", eventType: input.type, correlationId, error: message });
			return { recorded: false, error: message };
		}
	}

	private buildRow(input: PlatformEventInput): Prisma.OutboxEventCreateManyInput & { readonly id: PlatformEventId } {
		const event = PlatformEventInputSchema.parse(input);
		const correlationId = clamp(this.requestContext.correlationId() ?? null, OUTBOX_CORRELATION_ID_MAX_LENGTH);
		const envelope: PlatformEventEnvelope = PlatformEventEnvelopeSchema.parse({ ...event, correlationId, occurredAt: nowEpochMs() });
		return {
			id: randomUUID(),
			topic: PLATFORM_EVENT_TOPICS[envelope.type],
			eventType: envelope.type,
			partitionKey: clamp(resolvePartitionKey(event), OUTBOX_PARTITION_KEY_MAX_LENGTH),
			correlationId,
			payload: JsonObjectSchema.parse(JSON.parse(JSON.stringify(envelope))),
			status: "PENDING",
		};
	}
}

function clamp(value: string | null, maxLength: number): string | null {
	return value === null ? null : value.slice(0, maxLength);
}

/**
 * Kafka message key per event type — events sharing a key land on one
 * partition (ordered relative to each other). Rewards key by tenant so every
 * event for one organization stays ordered, falling back to the actor.
 */
export function resolvePartitionKey(event: PlatformEventInput): string | null {
	switch (event.type) {
		case "auth.flow":
			return event.payload.userId;
		case "session.action":
			return event.payload.userId;
		case "impersonation.action":
			return event.payload.superAdminId;
		case "email.log.updated":
			return event.payload.to;
		case "reward.platform":
			return event.payload.organizationId ?? event.payload.actorUserId;
	}
}

import { z } from "zod";

import {
	JsonValueSchema,
	PLATFORM_EVENT_TOPICS,
	PlatformEventMessageSchema,
	readPlatformEventOrganizationId,
	type JsonValue,
	type PlatformEventMessage,
} from "@workspace/shared";

import type { DeadLetterReason, InboxStore, KafkaCoordinates } from "./inbox";

/** Inbox consumer id — equals the Kafka consumer group so each logical consumer dedupes independently. */
export const ANALYTICS_CONSUMER_ID = "analytics-warehouse";

/** One Kafka record as the handler sees it (kafkajs `EachMessagePayload`, narrowed). */
export interface KafkaRecord extends KafkaCoordinates {
	readonly value: Buffer | null;
}

export type HandleOutcome =
	| { readonly kind: "processed"; readonly eventId: string }
	| { readonly kind: "duplicate"; readonly eventId: string }
	| { readonly kind: "parked"; readonly reason: DeadLetterReason; readonly eventId: string | null };

export type ConsumerLogEntry = Readonly<Record<string, string | number | null>>;

/** Structured log sink — one JSON object per line in production. */
export interface ConsumerLogger {
	info(entry: ConsumerLogEntry): void;
	warn(entry: ConsumerLogEntry): void;
	error(entry: ConsumerLogEntry): void;
}

export interface MessageHandlerDeps {
	readonly store: InboxStore;
	readonly logger: ConsumerLogger;
	readonly consumerId: string;
	readonly nowMs: () => number;
}

/** Best-effort event id from a message that failed full validation (for the dead-letter row). */
const EventIdProbeSchema = z.object({ eventId: z.uuid() });

/** Any `pg` error exposes its SQLSTATE as a 5-character `code`. */
const PgErrorCodeSchema = z.object({ code: z.string().length(5) });

/**
 * SQLSTATE classes that describe THIS message's data (22 data exception,
 * 23 integrity constraint violation): retrying the same record can never
 * succeed, so it is parked. Everything else — connection loss, deadlock,
 * serialization failure, permissions — is treated as transient and rethrown
 * so Kafka redelivers the record (the partition waits instead of dropping it).
 */
const PERMANENT_SQLSTATE_CLASSES: readonly string[] = ["22", "23"];

class PoisonMessageError extends Error {
	public constructor(
		public readonly reason: DeadLetterReason,
		message: string,
		public readonly eventId: string | null,
	) {
		super(message);
		this.name = "PoisonMessageError";
	}
}

type JsonDecodeResult = { readonly success: true; readonly data: JsonValue } | { readonly success: false; readonly error: string };

function decodeJson(raw: string): JsonDecodeResult {
	try {
		return { success: true, data: JsonValueSchema.parse(JSON.parse(raw)) };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export function isPermanentProcessingError(error: Error): boolean {
	const parsed = PgErrorCodeSchema.safeParse(error);
	return parsed.success && PERMANENT_SQLSTATE_CLASSES.includes(parsed.data.code.slice(0, 2));
}

/** Decode + validate the record at the consumer boundary. Throws {@link PoisonMessageError}. */
export function decodePlatformMessage(record: KafkaRecord): PlatformEventMessage {
	if (record.value === null) {
		throw new PoisonMessageError("EMPTY_MESSAGE", "message has no value (tombstone)", null);
	}
	const decoded = decodeJson(record.value.toString("utf8"));
	if (!decoded.success) {
		throw new PoisonMessageError("MALFORMED_JSON", decoded.error, null);
	}
	const json = decoded.data;
	const probe = EventIdProbeSchema.safeParse(json);
	const eventId = probe.success ? probe.data.eventId : null;
	const parsed = PlatformEventMessageSchema.safeParse(json);
	if (!parsed.success) {
		throw new PoisonMessageError("SCHEMA_VIOLATION", z.prettifyError(parsed.error), eventId);
	}
	const expectedTopic = PLATFORM_EVENT_TOPICS[parsed.data.type];
	if (expectedTopic !== record.topic) {
		throw new PoisonMessageError("SCHEMA_VIOLATION", `event type ${parsed.data.type} belongs on ${expectedTopic}, received on ${record.topic}`, eventId);
	}
	return parsed.data;
}

/**
 * Idempotent, poison-safe processing of one platform event:
 *
 * 1. validate with the shared zod contract — invalid → park (never crash-loop);
 * 2. in ONE transaction: claim `(consumer, eventId)` in the inbox with
 *    `ON CONFLICT DO NOTHING`, and only if the claim is new, write the
 *    analytics row. A redelivery or producer republish is a no-op;
 * 3. a data error on this record → park; any other error → rethrow (transient,
 *    Kafka redelivers after its retry backoff).
 */
export async function handlePlatformMessage(record: KafkaRecord, deps: MessageHandlerDeps): Promise<HandleOutcome> {
	const startedAt = deps.nowMs();
	const coordinates = { topic: record.topic, partition: record.partition, offset: record.offset };

	let message: PlatformEventMessage;
	try {
		message = decodePlatformMessage(record);
	} catch (error) {
		if (error instanceof PoisonMessageError) {
			return park(record, deps, error.reason, error.message, error.eventId);
		}
		throw error;
	}

	try {
		const applied = await deps.store.inTransaction(async (tx): Promise<boolean> => {
			const isFirstDelivery = await tx.claim({ consumer: deps.consumerId, eventId: message.eventId, topic: record.topic, eventType: message.type });
			if (!isFirstDelivery) {
				return false;
			}
			const organizationId = readPlatformEventOrganizationId(message.payload);
			await tx.insertAnalyticsEvent({
				eventId: message.eventId,
				topic: record.topic,
				eventType: message.type,
				correlationId: message.correlationId,
				partitionKey: organizationId ?? message.type,
				payload: { eventId: message.eventId, type: message.type, correlationId: message.correlationId, organizationId, occurredAt: message.occurredAt },
				occurredAt: message.occurredAt,
			});
			return true;
		});

		const durationMs = deps.nowMs() - startedAt;
		if (!applied) {
			deps.logger.info({ event: "analytics.event_duplicate", eventId: message.eventId, eventType: message.type, ...coordinates, durationMs });
			return { kind: "duplicate", eventId: message.eventId };
		}
		deps.logger.info({
			event: "analytics.event_ingested",
			eventId: message.eventId,
			eventType: message.type,
			correlationId: message.correlationId,
			...coordinates,
			durationMs,
		});
		return { kind: "processed", eventId: message.eventId };
	} catch (error) {
		const failure = error instanceof Error ? error : new Error(String(error));
		if (isPermanentProcessingError(failure)) {
			return park(record, deps, "PERMANENT_PROCESSING_ERROR", failure.message, message.eventId);
		}
		deps.logger.error({ event: "analytics.processing_failed_transient", eventId: message.eventId, ...coordinates, error: failure.message });
		throw failure;
	}
}

async function park(record: KafkaRecord, deps: MessageHandlerDeps, reason: DeadLetterReason, error: string, eventId: string | null): Promise<HandleOutcome> {
	await deps.store.park({
		consumer: deps.consumerId,
		topic: record.topic,
		partition: record.partition,
		offset: record.offset,
		eventId,
		reason,
		error,
		rawValue: record.value === null ? null : record.value.toString("utf8"),
	});
	deps.logger.warn({ event: "analytics.message_parked", reason, eventId, topic: record.topic, partition: record.partition, offset: record.offset, error });
	return { kind: "parked", reason, eventId };
}

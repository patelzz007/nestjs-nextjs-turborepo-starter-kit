import { z } from "zod";

import {
	JsonValueSchema,
	PLATFORM_EVENT_TOPICS,
	PlatformEventMessageSchema,
	readPlatformEventOrganizationId,
	type JsonValue,
	type PlatformEventMessage,
} from "@workspace/shared";

import { boundErrorText, captureDeadLetterPayload } from "./dead-letter";
import type { ProcessingRetrySettings } from "./inbox-settings";
import type { DeadLetterReason, InboxStore, KafkaCoordinates } from "./inbox";

/** Inbox consumer id — equals the Kafka consumer group so each logical consumer dedupes independently. */
export const ANALYTICS_CONSUMER_ID = "analytics-warehouse";

/** One Kafka record as the handler sees it (`EachMessagePayload`, narrowed). */
export interface KafkaRecord extends KafkaCoordinates {
	readonly value: Buffer | null;
}

export type HandleOutcome =
	| { readonly kind: "processed"; readonly eventId: string; readonly attempts: number }
	| { readonly kind: "duplicate"; readonly eventId: string; readonly attempts: number }
	| { readonly kind: "parked"; readonly reason: DeadLetterReason; readonly eventId: string | null; readonly attempts: number };

export type ConsumerLogEntry = Readonly<Record<string, string | number | null>>;

/** Structured log sink — one JSON object per line in production. */
export interface ConsumerLogger {
	info(entry: ConsumerLogEntry): void;
	warn(entry: ConsumerLogEntry): void;
	error(entry: ConsumerLogEntry): void;
}

/** Abortable delay — rejects as soon as `signal` aborts (graceful shutdown). */
export type AbortableSleep = (delayMs: number, signal: AbortSignal) => Promise<void>;

export interface MessageHandlerDeps {
	readonly store: InboxStore;
	readonly logger: ConsumerLogger;
	readonly consumerId: string;
	readonly nowMs: () => number;
	/** Bounded retry for failures that are not this record's fault (connection loss, deadlock, …). */
	readonly retry: ProcessingRetrySettings;
	/** Cap on the stored copy of a parked value (`ANALYTICS_DEAD_LETTER_MAX_PAYLOAD_BYTES`). */
	readonly deadLetterMaxPayloadBytes: number;
	readonly sleep: AbortableSleep;
	/** Uniform random in [0, 1) — the retry jitter source (seeded in tests). */
	readonly random: () => number;
	/** Aborted on shutdown: a record waiting between retries is released un-committed (redelivered after restart). */
	readonly signal: AbortSignal;
}

/** Best-effort event id from a message that failed full validation (for the dead-letter row). */
const EventIdProbeSchema = z.object({ eventId: z.uuid() });

/** Any `pg` error exposes its SQLSTATE as a 5-character `code`. */
const PgErrorCodeSchema = z.object({ code: z.string().length(5) });

/**
 * SQLSTATE classes that describe THIS record's data (22 data exception,
 * 23 integrity constraint violation): retrying the same record can never
 * succeed, so it is parked at once.
 */
const PERMANENT_SQLSTATE_CLASSES: readonly string[] = ["22", "23"];

/** ± share of the backoff delay randomised, so instances retrying the same outage do not stampede. */
export const RETRY_JITTER_RATIO = 0.2;

/**
 * How a processing failure is handled:
 * - `permanent_data` — the record's own data is rejected (SQLSTATE 22 / 23): park now;
 * - `retryable` — anything else (connection loss, timeout, deadlock,
 *   serialization failure, missing privilege, a bug): retried with
 *   exponential backoff, then parked as `RETRIES_EXHAUSTED` — never retried forever.
 */
export type ProcessingFailureKind = "permanent_data" | "retryable";

export interface ProcessingFailureClassification {
	readonly kind: ProcessingFailureKind;
	/** SQLSTATE when the failure came from Postgres. */
	readonly sqlState: string | null;
}

export function classifyProcessingFailure(error: Error): ProcessingFailureClassification {
	const parsed = PgErrorCodeSchema.safeParse(error);
	if (!parsed.success) {
		return { kind: "retryable", sqlState: null };
	}
	const sqlState = parsed.data.code;
	return { kind: PERMANENT_SQLSTATE_CLASSES.includes(sqlState.slice(0, 2)) ? "permanent_data" : "retryable", sqlState };
}

/**
 * Delay before retry number `attempt` (1-based: the delay after the first
 * failed attempt): `base × 2^(attempt-1)`, capped at `maxDelayMs`, ± jitter.
 */
export function retryDelayMs(attempt: number, settings: ProcessingRetrySettings, random: () => number): number {
	const exponential: number = Math.min(settings.maxDelayMs, settings.baseDelayMs * 2 ** (attempt - 1));
	const jitterFactor: number = 1 - RETRY_JITTER_RATIO + 2 * RETRY_JITTER_RATIO * random();
	return Math.round(Math.min(settings.maxDelayMs, exponential * jitterFactor));
}

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

/** Shutdown began while the record was waiting to retry — it is left un-committed and redelivered after restart. */
export class ProcessingAbortedError extends Error {
	public constructor(
		public readonly coordinates: KafkaCoordinates,
		public readonly attempts: number,
	) {
		super(`processing of ${coordinates.topic}/${String(coordinates.partition)}@${coordinates.offset} aborted by shutdown after ${String(attempts)} attempt(s)`);
		this.name = "ProcessingAbortedError";
	}
}

/** The dead-letter row could not be written (database unreachable) — the record is NOT committed and will be redelivered. */
export class DeadLetterWriteError extends Error {
	public constructor(
		public readonly coordinates: KafkaCoordinates,
		options: { readonly cause: Error },
	) {
		super(`could not park ${coordinates.topic}/${String(coordinates.partition)}@${coordinates.offset}: ${options.cause.message}`, options);
		this.name = "DeadLetterWriteError";
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

/** Strict UTF-8: a value with invalid byte sequences is malformed, not silently "repaired" with U+FFFD. */
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });

/** Decode + validate the record at the consumer boundary. Throws {@link PoisonMessageError}. */
export function decodePlatformMessage(record: KafkaRecord): PlatformEventMessage {
	if (record.value === null) {
		throw new PoisonMessageError("EMPTY_MESSAGE", "message has no value (tombstone)", null);
	}
	let text: string;
	try {
		text = UTF8_DECODER.decode(record.value);
	} catch {
		throw new PoisonMessageError("MALFORMED_JSON", "message value is not valid UTF-8", null);
	}
	const decoded = decodeJson(text);
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

/** Claim + analytics write in ONE transaction. Returns false for a duplicate delivery. */
function applyMessage(record: KafkaRecord, message: PlatformEventMessage, deps: MessageHandlerDeps): Promise<boolean> {
	return deps.store.inTransaction(async (tx): Promise<boolean> => {
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
}

/**
 * Idempotent, poison-safe processing of one platform event:
 *
 * 1. validate with the shared zod contract — undecodable / invalid → park now;
 * 2. in ONE transaction: claim `(consumer, eventId)` in the inbox with
 *    `ON CONFLICT DO NOTHING`, and only if the claim is new, write the
 *    analytics row. A redelivery or producer republish is a no-op;
 * 3. a data error on this record (SQLSTATE 22/23) → park now; any other
 *    failure → retry with exponential backoff + jitter, at most
 *    `retry.maxAttempts` attempts, then park as `RETRIES_EXHAUSTED`.
 *
 * The handler resolves (offset committed) only once the record is applied,
 * recognised as a duplicate, or durably parked. It rejects — leaving the
 * offset uncommitted so the record is redelivered — only when parking itself
 * fails ({@link DeadLetterWriteError}) or shutdown interrupts a retry wait
 * ({@link ProcessingAbortedError}).
 */
export async function handlePlatformMessage(record: KafkaRecord, deps: MessageHandlerDeps): Promise<HandleOutcome> {
	const coordinates: KafkaCoordinates = { topic: record.topic, partition: record.partition, offset: record.offset };

	let message: PlatformEventMessage;
	try {
		message = decodePlatformMessage(record);
	} catch (error) {
		if (error instanceof PoisonMessageError) {
			return park(record, deps, { reason: error.reason, error: error.message, eventId: error.eventId, attempts: 1 });
		}
		throw error;
	}

	for (let attempt = 1; ; attempt += 1) {
		if (deps.signal.aborted) {
			throw new ProcessingAbortedError(coordinates, attempt - 1);
		}
		const startedAt = deps.nowMs();
		try {
			const applied = await applyMessage(record, message, deps);
			const durationMs = deps.nowMs() - startedAt;
			if (!applied) {
				deps.logger.info({ event: "analytics.event_duplicate", eventId: message.eventId, eventType: message.type, ...coordinates, attempt, durationMs });
				return { kind: "duplicate", eventId: message.eventId, attempts: attempt };
			}
			deps.logger.info({
				event: "analytics.event_ingested",
				eventId: message.eventId,
				eventType: message.type,
				correlationId: message.correlationId,
				...coordinates,
				attempt,
				durationMs,
			});
			return { kind: "processed", eventId: message.eventId, attempts: attempt };
		} catch (error) {
			const failure = error instanceof Error ? error : new Error(String(error));
			const classification = classifyProcessingFailure(failure);
			if (classification.kind === "permanent_data") {
				return park(record, deps, { reason: "PERMANENT_PROCESSING_ERROR", error: failure.message, eventId: message.eventId, attempts: attempt });
			}
			if (attempt >= deps.retry.maxAttempts) {
				deps.logger.error({
					event: "analytics.retries_exhausted",
					eventId: message.eventId,
					...coordinates,
					attempts: attempt,
					sqlState: classification.sqlState,
					error: failure.message,
				});
				return park(record, deps, {
					reason: "RETRIES_EXHAUSTED",
					error: `after ${String(attempt)} attempts: ${failure.message}`,
					eventId: message.eventId,
					attempts: attempt,
				});
			}
			const delayMs = retryDelayMs(attempt, deps.retry, deps.random);
			deps.logger.warn({
				event: "analytics.processing_retry",
				eventId: message.eventId,
				...coordinates,
				attempt,
				maxAttempts: deps.retry.maxAttempts,
				retryInMs: delayMs,
				sqlState: classification.sqlState,
				error: failure.message,
			});
			try {
				await deps.sleep(delayMs, deps.signal);
			} catch {
				throw new ProcessingAbortedError(coordinates, attempt);
			}
		}
	}
}

interface ParkDetails {
	readonly reason: DeadLetterReason;
	readonly error: string;
	readonly eventId: string | null;
	readonly attempts: number;
}

async function park(record: KafkaRecord, deps: MessageHandlerDeps, details: ParkDetails): Promise<HandleOutcome> {
	const coordinates: KafkaCoordinates = { topic: record.topic, partition: record.partition, offset: record.offset };
	const payload = record.value === null ? null : captureDeadLetterPayload(record.value, deps.deadLetterMaxPayloadBytes);
	const error = boundErrorText(details.error);
	try {
		await deps.store.park({ consumer: deps.consumerId, ...coordinates, eventId: details.eventId, reason: details.reason, error, attempts: details.attempts, payload });
	} catch (parkError) {
		const cause = parkError instanceof Error ? parkError : new Error(String(parkError));
		deps.logger.error({ event: "analytics.park_failed", reason: details.reason, eventId: details.eventId, ...coordinates, error: cause.message });
		throw new DeadLetterWriteError(coordinates, { cause });
	}
	deps.logger.warn({
		event: "analytics.message_parked",
		reason: details.reason,
		eventId: details.eventId,
		...coordinates,
		attempts: details.attempts,
		payloadBytes: payload?.sizeBytes ?? null,
		payloadTruncated: payload === null ? null : String(payload.truncated),
		error,
	});
	return { kind: "parked", reason: details.reason, eventId: details.eventId, attempts: details.attempts };
}

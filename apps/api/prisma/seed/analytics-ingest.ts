import { z } from "zod";

import { JsonObjectSchema } from "@workspace/shared";
import {
	ANALYTICS_CONSUMER_ID,
	createConsumerPool,
	handlePlatformMessage,
	PgInboxStore,
	type ConsumerLogger,
	type HandleOutcome,
	type KafkaRecord,
	type MessageHandlerDeps,
	type ProcessingRetrySettings,
} from "@workspace/messaging/inbox";

import { prisma } from "./client";
import { seedLog } from "./seed-log";

// ---------------------------------------------------------------------------
// `analytics_events` + `inbox_processed_events` — filled by the REAL consumer path.
//
// In a running system the analytics consumer reads every PUBLISHED outbox event from Kafka and writes
// both tables through `handlePlatformMessage` + `PgInboxStore` (claim + analytics row in one
// transaction, `ON CONFLICT DO NOTHING`). The seed does not re-implement that: it replays each
// PUBLISHED outbox row (the seeded ones, shaped by `PlatformOutboxService`) through the same handler and
// the same SQL, as the `analytics-warehouse` consumer. The row id is the outbox row id, so a re-run is a
// duplicate delivery (a no-op) — idempotent by the consumer's own guarantee. It connects with the seed's
// owner connection; the production `analytics_consumer` login (provisioned separately) is not needed.
// ---------------------------------------------------------------------------

const POOL_SETTINGS = { max: 1, connectionTimeoutMs: 10_000, idleTimeoutMs: 1_000, statementTimeoutMs: 30_000 };
/** The seed never retries: a failure is a seed bug and must surface. */
const NO_RETRY: ProcessingRetrySettings = { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0 };
const DEAD_LETTER_MAX_PAYLOAD_BYTES = 8_192;
const SEED_PARTITION = 0;
/** Offsets are per topic-partition; seed offsets start well above 0 so they read as a later slice of the log. */
const SEED_OFFSET_BASE = 1_000;

const SILENT_LOGGER: ConsumerLogger = {
	info: (): void => undefined,
	warn: (): void => undefined,
	error: (): void => undefined,
};

const PublishedOutboxRowSchema = z.object({ id: z.uuid(), topic: z.string(), payload: JsonObjectSchema });

export interface AnalyticsIngestSummary {
	readonly processed: number;
	readonly duplicates: number;
}

/** Replays every PUBLISHED outbox event through the analytics consumer's own handler. */
export async function seedAnalyticsIngest(): Promise<AnalyticsIngestSummary> {
	const databaseUrl: string | undefined = process.env.DATABASE_URL;
	if (databaseUrl === undefined) {
		throw new Error("DATABASE_URL is required to seed analytics events");
	}
	const published = await prisma.outboxEvent.findMany({ where: { status: "PUBLISHED" }, orderBy: [{ topic: "asc" }, { createdAt: "asc" }, { id: "asc" }] });
	const pool = createConsumerPool(databaseUrl, POOL_SETTINGS);
	const controller = new AbortController();
	const deps: MessageHandlerDeps = {
		store: new PgInboxStore(pool),
		logger: SILENT_LOGGER,
		consumerId: ANALYTICS_CONSUMER_ID,
		nowMs: Date.now,
		retry: NO_RETRY,
		deadLetterMaxPayloadBytes: DEAD_LETTER_MAX_PAYLOAD_BYTES,
		sleep: (): Promise<void> => Promise.resolve(),
		random: (): number => 0,
		signal: controller.signal,
	};

	let processed = 0;
	let duplicates = 0;
	const offsets = new Map<string, number>();
	try {
		for (const row of published) {
			const parsed = PublishedOutboxRowSchema.parse(row);
			const offset: number = (offsets.get(parsed.topic) ?? SEED_OFFSET_BASE) + 1;
			offsets.set(parsed.topic, offset);
			// The wire message is the stored envelope plus the stable event id (the outbox row id).
			const record: KafkaRecord = {
				topic: parsed.topic,
				partition: SEED_PARTITION,
				offset: String(offset),
				value: Buffer.from(JSON.stringify({ ...parsed.payload, eventId: parsed.id }), "utf8"),
			};
			const outcome: HandleOutcome = await handlePlatformMessage(record, deps);
			if (outcome.kind === "parked") {
				throw new Error(`The analytics consumer parked seeded event ${parsed.id}: ${outcome.reason}`);
			}
			if (outcome.kind === "processed") {
				processed += 1;
			} else {
				duplicates += 1;
			}
		}
	} finally {
		await pool.end();
	}
	seedLog(`✅ analytics ingest: ${String(processed)} event(s) applied, ${String(duplicates)} already ingested`);
	return { processed, duplicates };
}

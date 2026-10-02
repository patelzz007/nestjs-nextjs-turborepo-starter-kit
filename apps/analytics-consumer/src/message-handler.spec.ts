import { beforeEach, describe, expect, it } from "vitest";

import type { AnalyticsEventRow, DeadLetterInput, InboxClaim, InboxStore, InboxTransaction } from "./inbox";
import {
	ANALYTICS_CONSUMER_ID,
	decodePlatformMessage,
	handlePlatformMessage,
	isPermanentProcessingError,
	type ConsumerLogEntry,
	type ConsumerLogger,
	type KafkaRecord,
	type MessageHandlerDeps,
} from "./message-handler";

const EVENT_ID = "0b8f5a52-6a3c-4c3e-9d8e-5d8b5f0f4a11";
const ORGANIZATION_ID = "5c1f7a9e-2b4d-4e8f-a1b2-c3d4e5f60718";
const OCCURRED_AT_MS = 1_790_812_800_000;

/** `pg` DatabaseError carries its SQLSTATE in `code`. */
class FakePgError extends Error {
	public constructor(
		message: string,
		public readonly code: string,
	) {
		super(message);
	}
}

/**
 * In-memory inbox with Postgres-like semantics: the (consumer, eventId) claim
 * is a unique key, and writes inside `inTransaction` are only committed when
 * the work resolves — a throw rolls back the claim AND the analytics row.
 */
class InMemoryInboxStore implements InboxStore {
	public readonly processed = new Set<string>();
	public readonly analytics: AnalyticsEventRow[] = [];
	public readonly deadLetters = new Map<string, DeadLetterInput>();
	public analyticsFailure: Error | null = null;
	public parkFailure: Error | null = null;

	public async inTransaction<T>(work: (tx: InboxTransaction) => Promise<T>): Promise<T> {
		const stagedClaims: string[] = [];
		const stagedRows: AnalyticsEventRow[] = [];
		const tx: InboxTransaction = {
			claim: (claim: InboxClaim): Promise<boolean> => {
				const key = `${claim.consumer}:${claim.eventId}`;
				if (this.processed.has(key) || stagedClaims.includes(key)) {
					return Promise.resolve(false);
				}
				stagedClaims.push(key);
				return Promise.resolve(true);
			},
			insertAnalyticsEvent: (row: AnalyticsEventRow): Promise<void> => {
				if (this.analyticsFailure !== null) {
					return Promise.reject(this.analyticsFailure);
				}
				stagedRows.push(row);
				return Promise.resolve();
			},
		};
		const result = await work(tx);
		for (const key of stagedClaims) {
			this.processed.add(key);
		}
		this.analytics.push(...stagedRows);
		return result;
	}

	public park(deadLetter: DeadLetterInput): Promise<void> {
		if (this.parkFailure !== null) {
			return Promise.reject(this.parkFailure);
		}
		const key = `${deadLetter.consumer}:${deadLetter.topic}:${String(deadLetter.partition)}:${deadLetter.offset}`;
		if (!this.deadLetters.has(key)) {
			this.deadLetters.set(key, deadLetter);
		}
		return Promise.resolve();
	}
}

class CapturingLogger implements ConsumerLogger {
	public readonly lines: { readonly level: string; readonly entry: ConsumerLogEntry }[] = [];

	public info(entry: ConsumerLogEntry): void {
		this.lines.push({ level: "info", entry });
	}

	public warn(entry: ConsumerLogEntry): void {
		this.lines.push({ level: "warn", entry });
	}

	public error(entry: ConsumerLogEntry): void {
		this.lines.push({ level: "error", entry });
	}
}

function rewardMessage(overrides: Readonly<Record<string, string | number | null>> = {}): string {
	return JSON.stringify({
		eventId: EVENT_ID,
		type: "reward.platform",
		correlationId: "corr-1",
		occurredAt: OCCURRED_AT_MS,
		payload: { event: "reward.auto_published", actorUserId: null, organizationId: ORGANIZATION_ID, metadata: { rewardId: "reward-1" } },
		...overrides,
	});
}

function record(value: string | null, offset = "42", topic = "platform.rewards"): KafkaRecord {
	return { topic, partition: 0, offset, value: value === null ? null : Buffer.from(value, "utf8") };
}

describe("handlePlatformMessage", () => {
	let store: InMemoryInboxStore;
	let logger: CapturingLogger;
	let deps: MessageHandlerDeps;

	beforeEach(() => {
		store = new InMemoryInboxStore();
		logger = new CapturingLogger();
		deps = { store, logger, consumerId: ANALYTICS_CONSUMER_ID, nowMs: (): number => OCCURRED_AT_MS };
	});

	it("ingests a valid event once, keyed by its stable eventId", async () => {
		const outcome = await handlePlatformMessage(record(rewardMessage()), deps);

		expect(outcome).toEqual({ kind: "processed", eventId: EVENT_ID });
		expect(store.analytics).toEqual([
			{
				eventId: EVENT_ID,
				topic: "platform.rewards",
				eventType: "reward.platform",
				correlationId: "corr-1",
				partitionKey: ORGANIZATION_ID,
				payload: { eventId: EVENT_ID, type: "reward.platform", correlationId: "corr-1", organizationId: ORGANIZATION_ID, occurredAt: OCCURRED_AT_MS },
				occurredAt: OCCURRED_AT_MS,
			},
		]);
	});

	it("processes a redelivered message (same offset) exactly once", async () => {
		await handlePlatformMessage(record(rewardMessage()), deps);
		const redelivery = await handlePlatformMessage(record(rewardMessage()), deps);

		expect(redelivery).toEqual({ kind: "duplicate", eventId: EVENT_ID });
		expect(store.analytics).toHaveLength(1);
		expect(logger.lines.map(({ entry }) => entry.event)).toEqual(["analytics.event_ingested", "analytics.event_duplicate"]);
	});

	it("processes a producer republish (same eventId, new offset) exactly once", async () => {
		await handlePlatformMessage(record(rewardMessage(), "42"), deps);
		const republish = await handlePlatformMessage(record(rewardMessage(), "97"), deps);

		expect(republish.kind).toBe("duplicate");
		expect(store.analytics).toHaveLength(1);
	});

	it("rolls back the inbox claim when the analytics write fails transiently, so the redelivery is applied", async () => {
		store.analyticsFailure = new FakePgError("terminating connection due to administrator command", "57P01");

		await expect(handlePlatformMessage(record(rewardMessage()), deps)).rejects.toThrow("terminating connection");
		expect(store.processed.size).toBe(0);
		expect(logger.lines.at(-1)).toMatchObject({ level: "error", entry: { event: "analytics.processing_failed_transient", eventId: EVENT_ID } });

		store.analyticsFailure = null;
		await expect(handlePlatformMessage(record(rewardMessage()), deps)).resolves.toEqual({ kind: "processed", eventId: EVENT_ID });
		expect(store.analytics).toHaveLength(1);
	});

	it("parks a message whose data the database rejects permanently instead of crash-looping", async () => {
		store.analyticsFailure = new FakePgError("value too long for type character varying(64)", "22001");

		const outcome = await handlePlatformMessage(record(rewardMessage()), deps);

		expect(outcome).toEqual({ kind: "parked", reason: "PERMANENT_PROCESSING_ERROR", eventId: EVENT_ID });
		expect(store.processed.size).toBe(0);
		expect([...store.deadLetters.values()][0]).toMatchObject({ reason: "PERMANENT_PROCESSING_ERROR", error: "value too long for type character varying(64)" });
	});

	it.each([
		["an empty (tombstone) value", null, "EMPTY_MESSAGE"],
		["malformed JSON", "{not json", "MALFORMED_JSON"],
		["a message without an eventId", JSON.stringify({ type: "reward.platform", correlationId: null, occurredAt: OCCURRED_AT_MS, payload: {} }), "SCHEMA_VIOLATION"],
		["an unknown event type", rewardMessage({ type: "reward.unknown" }), "SCHEMA_VIOLATION"],
	])("parks %s with a reason and keeps the partition flowing", async (_label, value, reason) => {
		const outcome = await handlePlatformMessage(record(value), deps);

		expect(outcome).toMatchObject({ kind: "parked", reason });
		expect(store.analytics).toEqual([]);
		expect(store.processed.size).toBe(0);
		const [parked] = [...store.deadLetters.values()];
		expect(parked).toMatchObject({ consumer: ANALYTICS_CONSUMER_ID, topic: "platform.rewards", partition: 0, offset: "42", reason, rawValue: value });
		expect(logger.lines.find(({ entry }) => entry.event === "analytics.message_parked")).toMatchObject({ level: "warn", entry: { reason } });
	});

	it("keeps the event id on the dead letter when the envelope carried one", async () => {
		const outcome = await handlePlatformMessage(record(rewardMessage({ occurredAt: -1 })), deps);

		expect(outcome).toEqual({ kind: "parked", reason: "SCHEMA_VIOLATION", eventId: EVENT_ID });
	});

	it("parks an event published on the wrong topic", async () => {
		const outcome = await handlePlatformMessage(record(rewardMessage(), "42", "platform.auth"), deps);

		expect(outcome).toMatchObject({ kind: "parked", reason: "SCHEMA_VIOLATION" });
		expect([...store.deadLetters.values()][0]?.error).toBe("event type reward.platform belongs on platform.rewards, received on platform.auth");
	});

	it("parks the same poison record only once across redeliveries", async () => {
		await handlePlatformMessage(record("{not json"), deps);
		await handlePlatformMessage(record("{not json"), deps);

		expect(store.deadLetters.size).toBe(1);
	});

	it("rethrows when parking itself fails, so the poison record is retried rather than lost", async () => {
		store.parkFailure = new Error("connection refused");

		await expect(handlePlatformMessage(record("{not json"), deps)).rejects.toThrow("connection refused");
	});
});

describe("decodePlatformMessage", () => {
	it("returns the validated wire message", () => {
		expect(decodePlatformMessage(record(rewardMessage()))).toMatchObject({ eventId: EVENT_ID, type: "reward.platform" });
	});
});

describe("isPermanentProcessingError", () => {
	it.each([
		["22001", true],
		["23502", true],
		["57P01", false],
		["40001", false],
		["08006", false],
		["42501", false],
	])("classifies SQLSTATE %s as permanent=%s", (code, expected) => {
		expect(isPermanentProcessingError(new FakePgError("x", code))).toBe(expected);
	});

	it("treats errors without a SQLSTATE as transient", () => {
		expect(isPermanentProcessingError(new Error("socket hang up"))).toBe(false);
	});
});

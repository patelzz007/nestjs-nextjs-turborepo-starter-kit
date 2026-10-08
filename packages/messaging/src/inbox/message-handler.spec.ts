import { beforeEach, describe, expect, it } from "vitest";

import type { AnalyticsEventRow, DeadLetterInput, InboxClaim, InboxStore, InboxTransaction } from "./inbox";
import {
	ANALYTICS_CONSUMER_ID,
	classifyProcessingFailure,
	DeadLetterWriteError,
	decodePlatformMessage,
	handlePlatformMessage,
	ProcessingAbortedError,
	retryDelayMs,
	type AbortableSleep,
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
	/** One entry per upcoming analytics write: an Error fails that attempt, `null` lets it through. */
	public readonly analyticsFailures: (Error | null)[] = [];
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
				const failure = this.analyticsFailures.shift() ?? null;
				if (failure !== null) {
					return Promise.reject(failure);
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

	/** The first dead letter recorded (insertion order), if any. */
	public firstDeadLetter(): DeadLetterInput | undefined {
		const [first] = this.deadLetters.values();
		return first;
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

const RETRY = { maxAttempts: 4, baseDelayMs: 100, maxDelayMs: 1_000 };
const MAX_PAYLOAD_BYTES = 1_024;

/** Records every requested delay and resolves at once — no real waiting. */
class FakeSleep {
	public readonly delays: number[] = [];

	public readonly sleep: AbortableSleep = (delayMs: number, signal: AbortSignal): Promise<void> => {
		this.delays.push(delayMs);
		return signal.aborted ? Promise.reject(new Error("aborted")) : Promise.resolve();
	};
}

function transient(): FakePgError {
	return new FakePgError("terminating connection due to administrator command", "57P01");
}

describe("handlePlatformMessage", () => {
	let store: InMemoryInboxStore;
	let logger: CapturingLogger;
	let sleeper: FakeSleep;
	let shutdown: AbortController;
	let deps: MessageHandlerDeps;

	beforeEach(() => {
		store = new InMemoryInboxStore();
		logger = new CapturingLogger();
		sleeper = new FakeSleep();
		shutdown = new AbortController();
		deps = {
			store,
			logger,
			consumerId: ANALYTICS_CONSUMER_ID,
			nowMs: (): number => OCCURRED_AT_MS,
			retry: RETRY,
			deadLetterMaxPayloadBytes: MAX_PAYLOAD_BYTES,
			sleep: sleeper.sleep,
			random: (): number => 0.5,
			signal: shutdown.signal,
		};
	});

	it("ingests a valid event once, keyed by its stable eventId", async () => {
		const outcome = await handlePlatformMessage(record(rewardMessage()), deps);

		expect(outcome).toEqual({ kind: "processed", eventId: EVENT_ID, attempts: 1 });
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

		expect(redelivery).toEqual({ kind: "duplicate", eventId: EVENT_ID, attempts: 1 });
		expect(store.analytics).toHaveLength(1);
		expect(logger.lines.map(({ entry }) => entry.event)).toEqual(["analytics.event_ingested", "analytics.event_duplicate"]);
	});

	it("processes a producer republish (same eventId, new offset) exactly once", async () => {
		await handlePlatformMessage(record(rewardMessage(), "42"), deps);
		const republish = await handlePlatformMessage(record(rewardMessage(), "97"), deps);

		expect(republish.kind).toBe("duplicate");
		expect(store.analytics).toHaveLength(1);
	});

	it("retries a transient failure with backoff (claim rolled back each time) and applies the event once it clears", async () => {
		store.analyticsFailures.push(transient(), transient());

		const outcome = await handlePlatformMessage(record(rewardMessage()), deps);

		expect(outcome).toEqual({ kind: "processed", eventId: EVENT_ID, attempts: 3 });
		expect(store.analytics).toHaveLength(1);
		expect(sleeper.delays).toEqual([100, 200]);
		expect(logger.lines.filter(({ entry }) => entry.event === "analytics.processing_retry")).toHaveLength(2);
	});

	it("never retries forever: after maxAttempts it parks the record as RETRIES_EXHAUSTED and alerts", async () => {
		store.analyticsFailures.push(transient(), transient(), transient(), transient(), transient());

		const outcome = await handlePlatformMessage(record(rewardMessage()), deps);

		expect(outcome).toEqual({ kind: "parked", reason: "RETRIES_EXHAUSTED", eventId: EVENT_ID, attempts: RETRY.maxAttempts });
		expect(sleeper.delays).toHaveLength(RETRY.maxAttempts - 1);
		expect(store.processed.size).toBe(0);
		expect(store.firstDeadLetter()).toMatchObject({ reason: "RETRIES_EXHAUSTED", attempts: RETRY.maxAttempts });
		expect(logger.lines.find(({ entry }) => entry.event === "analytics.retries_exhausted")).toMatchObject({ level: "error", entry: { sqlState: "57P01" } });
	});

	it("treats an error without a SQLSTATE (e.g. a connection timeout or a bug) as retryable but bounded", async () => {
		store.analyticsFailures.push(...Array.from({ length: RETRY.maxAttempts }, (): Error => new Error("Connection terminated due to connection timeout")));

		await expect(handlePlatformMessage(record(rewardMessage()), deps)).resolves.toMatchObject({ kind: "parked", reason: "RETRIES_EXHAUSTED" });
	});

	it("parks a message whose data the database rejects permanently, without retrying", async () => {
		store.analyticsFailures.push(new FakePgError("value too long for type character varying(64)", "22001"));

		const outcome = await handlePlatformMessage(record(rewardMessage()), deps);

		expect(outcome).toEqual({ kind: "parked", reason: "PERMANENT_PROCESSING_ERROR", eventId: EVENT_ID, attempts: 1 });
		expect(sleeper.delays).toEqual([]);
		expect(store.processed.size).toBe(0);
		expect(store.firstDeadLetter()).toMatchObject({ reason: "PERMANENT_PROCESSING_ERROR", error: "value too long for type character varying(64)" });
	});

	it("releases the record un-committed when shutdown interrupts a retry wait", async () => {
		store.analyticsFailures.push(transient());
		shutdown.abort();

		await expect(handlePlatformMessage(record(rewardMessage()), deps)).rejects.toBeInstanceOf(ProcessingAbortedError);
		expect(store.deadLetters.size).toBe(0);
		expect(store.analytics).toEqual([]);
	});

	it.each([
		["an empty (tombstone) value", null, "EMPTY_MESSAGE"],
		["malformed JSON", "{not json", "MALFORMED_JSON"],
		["a message without an eventId", JSON.stringify({ type: "reward.platform", correlationId: null, occurredAt: OCCURRED_AT_MS, payload: {} }), "SCHEMA_VIOLATION"],
		["an unknown event type", rewardMessage({ type: "reward.unknown" }), "SCHEMA_VIOLATION"],
	])("parks %s with a reason and keeps the partition flowing", async (_label, value, reason) => {
		const outcome = await handlePlatformMessage(record(value), deps);

		expect(outcome).toMatchObject({ kind: "parked", reason, attempts: 1 });
		expect(store.analytics).toEqual([]);
		expect(store.processed.size).toBe(0);
		const [parked] = [...store.deadLetters.values()];
		expect(parked).toMatchObject({ consumer: ANALYTICS_CONSUMER_ID, topic: "platform.rewards", partition: 0, offset: "42", reason, attempts: 1 });
		expect(parked?.payload === null ? null : parked?.payload.bytes.toString("utf8")).toBe(value);
		expect(logger.lines.find(({ entry }) => entry.event === "analytics.message_parked")).toMatchObject({ level: "warn", entry: { reason } });
	});

	it("parks a value that is not valid UTF-8 as MALFORMED_JSON, keeping the exact bytes", async () => {
		const invalidUtf8 = Buffer.from([0x7b, 0xff, 0xfe, 0x00, 0x7d]);

		const outcome = await handlePlatformMessage({ topic: "platform.rewards", partition: 0, offset: "7", value: invalidUtf8 }, deps);

		expect(outcome).toMatchObject({ kind: "parked", reason: "MALFORMED_JSON" });
		expect(store.firstDeadLetter()?.payload?.bytes.equals(invalidUtf8)).toBe(true);
	});

	it("stores an oversized value truncated, but with its original size, hash and an explicit flag", async () => {
		const oversized = "x".repeat(MAX_PAYLOAD_BYTES * 3);

		await handlePlatformMessage(record(oversized), deps);

		expect(store.firstDeadLetter()?.payload).toMatchObject({ sizeBytes: MAX_PAYLOAD_BYTES * 3, truncated: true });
		expect(store.firstDeadLetter()?.payload?.bytes.length).toBe(MAX_PAYLOAD_BYTES);
	});

	it("keeps the event id on the dead letter when the envelope carried one", async () => {
		const outcome = await handlePlatformMessage(record(rewardMessage({ occurredAt: -1 })), deps);

		expect(outcome).toEqual({ kind: "parked", reason: "SCHEMA_VIOLATION", eventId: EVENT_ID, attempts: 1 });
	});

	it("parks an event published on the wrong topic", async () => {
		const outcome = await handlePlatformMessage(record(rewardMessage(), "42", "platform.auth"), deps);

		expect(outcome).toMatchObject({ kind: "parked", reason: "SCHEMA_VIOLATION" });
		expect(store.firstDeadLetter()?.error).toBe("event type reward.platform belongs on platform.rewards, received on platform.auth");
	});

	it("parks the same poison record only once across redeliveries", async () => {
		await handlePlatformMessage(record("{not json"), deps);
		await handlePlatformMessage(record("{not json"), deps);

		expect(store.deadLetters.size).toBe(1);
	});

	it("rejects with DeadLetterWriteError when parking itself fails, so the record is redelivered rather than lost", async () => {
		store.parkFailure = new Error("connection refused");

		await expect(handlePlatformMessage(record("{not json"), deps)).rejects.toBeInstanceOf(DeadLetterWriteError);
		expect(logger.lines.at(-1)).toMatchObject({ level: "error", entry: { event: "analytics.park_failed" } });
	});
});

describe("decodePlatformMessage", () => {
	it("returns the validated wire message", () => {
		expect(decodePlatformMessage(record(rewardMessage()))).toMatchObject({ eventId: EVENT_ID, type: "reward.platform" });
	});
});

describe("classifyProcessingFailure", () => {
	it.each([
		["22001", "permanent_data"],
		["23502", "permanent_data"],
		["57P01", "retryable"],
		["40001", "retryable"],
		["40P01", "retryable"],
		["08006", "retryable"],
		["42501", "retryable"],
	])("classifies SQLSTATE %s as %s", (code, kind) => {
		expect(classifyProcessingFailure(new FakePgError("x", code))).toEqual({ kind, sqlState: code });
	});

	it("treats errors without a SQLSTATE as retryable", () => {
		expect(classifyProcessingFailure(new Error("socket hang up"))).toEqual({ kind: "retryable", sqlState: null });
	});
});

describe("retryDelayMs", () => {
	it("doubles from the base, caps at the maximum, and applies ±20% jitter", () => {
		const middle = (): number => 0.5;
		expect([1, 2, 3, 4, 5].map((attempt) => retryDelayMs(attempt, RETRY, middle))).toEqual([100, 200, 400, 800, 1_000]);
		expect(retryDelayMs(1, RETRY, () => 0)).toBe(80);
		expect(retryDelayMs(4, RETRY, () => 0.999_999)).toBe(960);
		expect(retryDelayMs(6, RETRY, () => 0.999_999)).toBe(RETRY.maxDelayMs);
	});
});

import { beforeEach, describe, expect, it } from "vitest";

import type { JsonValue, KafkaTopic, PlatformEventMessage } from "@workspace/shared";

import {
	OUTBOX_DISPATCH_LIMITS,
	OUTBOX_RETRY_POLICY,
	OutboxDispatcher,
	OutboxPublisherUnavailableError,
	computeOutboxRetryDelayMs,
	prepareOutboxRow,
	type ClaimedOutboxRow,
	type OutboxBacklog,
	type OutboxClock,
	type OutboxDispatchStore,
	type OutboxLogEntry,
	type OutboxLogSink,
	type OutboxPublisher,
	type OutboxRetryPolicy,
} from "./outbox-dispatcher";

const START_MS = 1_790_812_800_000;
const NO_JITTER = (): number => 0.5;
const USER_ID = "8d0f3b0e-1f7a-4c55-9d1e-2f1a6b7c8d90";

type RowStatus = "PENDING" | "PUBLISHED" | "FAILED";

interface StoredRow {
	readonly id: string;
	readonly topic: string;
	readonly partitionKey: string | null;
	readonly payload: JsonValue;
	readonly createdAt: number;
	status: RowStatus;
	attempts: number;
	availableAt: number;
	lastError: string | null;
}

/** In-memory outbox table with the same claim/lease semantics as `OutboxDispatchRepository`. */
class InMemoryOutboxStore implements OutboxDispatchStore {
	public readonly rows: StoredRow[] = [];
	public failNextMarkPublished = false;

	public add(id: string, overrides: Partial<Pick<StoredRow, "topic" | "payload">> = {}): void {
		this.rows.push({
			id,
			topic: overrides.topic ?? "platform.sessions",
			partitionKey: USER_ID,
			payload: overrides.payload ?? buildSessionEnvelope(),
			createdAt: START_MS + this.rows.length,
			status: "PENDING",
			attempts: 0,
			availableAt: START_MS,
			lastError: null,
		});
	}

	public get(id: string): StoredRow {
		const row = this.rows.find((candidate) => candidate.id === id);
		if (row === undefined) {
			throw new Error(`no row ${id}`);
		}
		return row;
	}

	public claimDue(limit: number, nowMs: number, leaseMs: number): Promise<readonly ClaimedOutboxRow[]> {
		const due = this.rows
			.filter((row) => row.status === "PENDING" && row.availableAt <= nowMs)
			.sort((left, right) => left.createdAt - right.createdAt)
			.slice(0, limit);
		for (const row of due) {
			row.availableAt = nowMs + leaseMs;
		}
		return Promise.resolve(due.map((row) => ({ id: row.id, topic: row.topic, partitionKey: row.partitionKey, attempts: row.attempts, payload: row.payload })));
	}

	public markPublished(id: string): Promise<void> {
		if (this.failNextMarkPublished) {
			this.failNextMarkPublished = false;
			return Promise.reject(new Error("database connection lost after publish"));
		}
		this.get(id).status = "PUBLISHED";
		return Promise.resolve();
	}

	public scheduleRetry(id: string, attempts: number, error: string, availableAtMs: number): Promise<void> {
		const row = this.get(id);
		row.attempts = attempts;
		row.lastError = error;
		row.availableAt = availableAtMs;
		return Promise.resolve();
	}

	public release(ids: readonly string[], availableAtMs: number): Promise<void> {
		for (const id of ids) {
			this.get(id).availableAt = availableAtMs;
		}
		return Promise.resolve();
	}

	public markDeadLettered(id: string, attempts: number, error: string): Promise<void> {
		const row = this.get(id);
		row.status = "FAILED";
		row.attempts = attempts;
		row.lastError = error;
		return Promise.resolve();
	}

	public readBacklog(): Promise<OutboxBacklog> {
		const pending = this.rows.filter((row) => row.status === "PENDING");
		const oldest = pending.reduce<number | null>((min, row) => (min === null || row.createdAt < min ? row.createdAt : min), null);
		return Promise.resolve({ pendingCount: pending.length, oldestPendingCreatedAt: oldest, deadLetteredCount: this.rows.filter((row) => row.status === "FAILED").length });
	}
}

class RecordingPublisher implements OutboxPublisher {
	public readonly published: { readonly topic: KafkaTopic; readonly message: PlatformEventMessage; readonly partitionKey: string | null }[] = [];
	public failuresRemaining = 0;
	/** Broker not connected: nothing is sent (KafkaProducerNotConnectedError upstream). */
	public isUnavailable = false;

	public publish(topic: KafkaTopic, message: PlatformEventMessage, partitionKey: string | null): Promise<void> {
		if (this.isUnavailable) {
			return Promise.reject(new OutboxPublisherUnavailableError("Kafka producer is connecting, not connected"));
		}
		if (this.failuresRemaining > 0) {
			this.failuresRemaining -= 1;
			return Promise.reject(new Error("KafkaJSConnectionError: broker unavailable"));
		}
		this.published.push({ topic, message, partitionKey });
		return Promise.resolve();
	}
}

class ManualClock implements OutboxClock {
	public now: number = START_MS;

	public nowEpochMs(): number {
		return this.now;
	}
}

class CapturingLogger implements OutboxLogSink {
	public readonly entries: { readonly level: "log" | "warn" | "error"; readonly entry: OutboxLogEntry }[] = [];

	public log(entry: OutboxLogEntry): void {
		this.entries.push({ level: "log", entry });
	}

	public warn(entry: OutboxLogEntry): void {
		this.entries.push({ level: "warn", entry });
	}

	public error(entry: OutboxLogEntry): void {
		this.entries.push({ level: "error", entry });
	}

	public events(): string[] {
		return this.entries.map(({ entry }) => String(entry.event));
	}

	/** The entries written at one level, in order. */
	public entriesAt(level: "log" | "warn" | "error"): OutboxLogEntry[] {
		return this.entries.filter((captured) => captured.level === level).map(({ entry }) => entry);
	}
}

function buildSessionEnvelope(): JsonValue {
	return {
		type: "session.action",
		correlationId: "corr-1",
		occurredAt: START_MS,
		payload: { action: "logout-all", userId: USER_ID, status: "succeeded", error: null, durationMs: 2 },
	};
}

const EVENT_A = "0b8f5a52-6a3c-4c3e-9d8e-5d8b5f0f4a11";
const EVENT_B = "1c9f6b63-7b4d-4d4f-8e9f-6e9c6a1a5b22";
const EVENT_C = "2da07c74-8c5e-4e50-9fa0-7fad7b2b6c33";

describe("OutboxDispatcher", () => {
	let store: InMemoryOutboxStore;
	let publisher: RecordingPublisher;
	let clock: ManualClock;
	let logger: CapturingLogger;
	let dispatcher: OutboxDispatcher;

	beforeEach(() => {
		store = new InMemoryOutboxStore();
		publisher = new RecordingPublisher();
		clock = new ManualClock();
		logger = new CapturingLogger();
		dispatcher = new OutboxDispatcher(store, publisher, clock, logger, OUTBOX_RETRY_POLICY, OUTBOX_DISPATCH_LIMITS, NO_JITTER);
	});

	it("publishes due rows in creation order with the row id as the stable eventId, then marks them published", async () => {
		store.add(EVENT_A);
		store.add(EVENT_B);

		const summary = await dispatcher.dispatchDue();

		expect(summary).toEqual({ claimed: 2, published: 2, retried: 0, deadLettered: 0, released: 0 });
		expect(publisher.published.map(({ message }) => message.eventId)).toEqual([EVENT_A, EVENT_B]);
		expect(publisher.published[0]).toMatchObject({ topic: "platform.sessions", partitionKey: USER_ID, message: { type: "session.action", correlationId: "corr-1" } });
		expect(store.get(EVENT_A).status).toBe("PUBLISHED");
		expect(logger.events()).toContain("outbox.published");
	});

	it("republishes the SAME eventId when a crash hits between publish and mark (at-least-once, idempotent downstream)", async () => {
		store.add(EVENT_A);
		store.failNextMarkPublished = true;

		await expect(dispatcher.dispatchDue()).rejects.toThrow("database connection lost after publish");
		expect(store.get(EVENT_A).status).toBe("PENDING");

		clock.now += OUTBOX_DISPATCH_LIMITS.claimLeaseMs;
		await dispatcher.dispatchDue();

		expect(publisher.published.map(({ message }) => message.eventId)).toEqual([EVENT_A, EVENT_A]);
		expect(store.get(EVENT_A).status).toBe("PUBLISHED");
	});

	it("does not reclaim a leased row before the lease lapses", async () => {
		store.add(EVENT_A);
		store.failNextMarkPublished = true;
		await expect(dispatcher.dispatchDue()).rejects.toThrow();

		const summary = await dispatcher.dispatchDue();

		expect(summary.claimed).toBe(0);
		expect(publisher.published).toHaveLength(1);
	});

	it("schedules a backoff retry on publish failure and releases the rest of the batch without attempting it", async () => {
		store.add(EVENT_A);
		store.add(EVENT_B);
		store.add(EVENT_C);
		publisher.failuresRemaining = 1;

		const summary = await dispatcher.dispatchDue();

		expect(summary).toEqual({ claimed: 3, published: 0, retried: 1, deadLettered: 0, released: 2 });
		const expectedRetryAt = START_MS + OUTBOX_RETRY_POLICY.baseDelayMs;
		expect(store.get(EVENT_A)).toMatchObject({ attempts: 1, availableAt: expectedRetryAt, lastError: "KafkaJSConnectionError: broker unavailable" });
		expect(store.get(EVENT_B)).toMatchObject({ attempts: 0, availableAt: expectedRetryAt });
		expect(store.get(EVENT_C)).toMatchObject({ attempts: 0, availableAt: expectedRetryAt });
		expect(logger.events()).toContain("outbox.publish_failed");
	});

	it("retries after the backoff elapses and succeeds", async () => {
		store.add(EVENT_A);
		publisher.failuresRemaining = 1;
		await dispatcher.dispatchDue();

		clock.now = store.get(EVENT_A).availableAt;
		const summary = await dispatcher.dispatchDue();

		expect(summary.published).toBe(1);
		expect(store.get(EVENT_A)).toMatchObject({ status: "PUBLISHED", attempts: 1 });
	});

	it("dead-letters a row after maxAttempts publish failures", async () => {
		store.add(EVENT_A);
		publisher.failuresRemaining = Number.MAX_SAFE_INTEGER;

		for (let attempt = 1; attempt <= OUTBOX_RETRY_POLICY.maxAttempts; attempt += 1) {
			clock.now = store.get(EVENT_A).availableAt;
			await dispatcher.dispatchDue();
		}

		expect(store.get(EVENT_A)).toMatchObject({ status: "FAILED", attempts: OUTBOX_RETRY_POLICY.maxAttempts });
		expect(logger.entriesAt("error")).toContainEqual(expect.objectContaining({ event: "outbox.dead_lettered", reason: "max_attempts_exceeded", eventId: EVENT_A }));

		clock.now += OUTBOX_RETRY_POLICY.maxDelayMs;
		expect((await dispatcher.dispatchDue()).claimed).toBe(0);
	});

	it("dead-letters a malformed row immediately and keeps publishing the rest (no poison-pill blocking)", async () => {
		store.add(EVENT_A, { payload: { type: "session.action", correlationId: null } });
		store.add(EVENT_B);

		const summary = await dispatcher.dispatchDue();

		expect(summary).toEqual({ claimed: 2, published: 1, retried: 0, deadLettered: 1, released: 0 });
		expect(store.get(EVENT_A).status).toBe("FAILED");
		expect(store.get(EVENT_B).status).toBe("PUBLISHED");
		expect(publisher.published.map(({ message }) => message.eventId)).toEqual([EVENT_B]);
	});

	it("warns when the oldest pending row is older than the stale threshold", async () => {
		store.add(EVENT_A);
		publisher.failuresRemaining = 1;
		clock.now = START_MS + OUTBOX_DISPATCH_LIMITS.staleBacklogAgeMs;

		await dispatcher.dispatchDue();

		expect(logger.entriesAt("warn")).toContainEqual(expect.objectContaining({ event: "outbox.backlog_stale", pendingCount: 1 }));
	});

	it("keeps rows PENDING without spending attempts while the publisher is unavailable — however long the outage", async () => {
		store.add(EVENT_A);
		store.add(EVENT_B);
		publisher.isUnavailable = true;

		for (let sweep = 0; sweep < OUTBOX_RETRY_POLICY.maxAttempts * 3; sweep += 1) {
			clock.now = store.get(EVENT_A).availableAt;
			const summary = await dispatcher.dispatchDue();
			expect(summary).toEqual({ claimed: 2, published: 0, retried: 0, deadLettered: 0, released: 2 });
		}

		expect(store.get(EVENT_A)).toMatchObject({ status: "PENDING", attempts: 0, lastError: null });
		expect(store.get(EVENT_B)).toMatchObject({ status: "PENDING", attempts: 0 });
		expect(logger.entriesAt("warn")).toContainEqual(expect.objectContaining({ event: "outbox.publisher_unavailable", released: 2 }));
		expect(logger.entriesAt("error")).toEqual([]);

		publisher.isUnavailable = false;
		clock.now = store.get(EVENT_A).availableAt;
		const recovered = await dispatcher.dispatchDue();

		expect(recovered.published).toBe(2);
		expect(store.get(EVENT_A)).toMatchObject({ status: "PUBLISHED", attempts: 0 });
	});

	it("stays quiet when there is nothing to dispatch", async () => {
		const summary = await dispatcher.dispatchDue();

		expect(summary.claimed).toBe(0);
		expect(logger.entries).toEqual([]);
	});
});

describe("prepareOutboxRow", () => {
	it("rejects a row whose topic does not match its event type", () => {
		const prepared = prepareOutboxRow({ id: EVENT_A, topic: "platform.auth", partitionKey: null, attempts: 0, payload: buildSessionEnvelope() });

		expect(prepared).toEqual({ kind: "malformed", error: "event type session.action does not belong on topic platform.auth" });
	});

	it("rejects an unknown topic", () => {
		expect(prepareOutboxRow({ id: EVENT_A, topic: "platform.unknown", partitionKey: null, attempts: 0, payload: buildSessionEnvelope() }).kind).toBe("malformed");
	});

	it("rejects a row id that is not a uuid (it could not be a stable event id)", () => {
		expect(prepareOutboxRow({ id: "not-a-uuid", topic: "platform.sessions", partitionKey: null, attempts: 0, payload: buildSessionEnvelope() }).kind).toBe("malformed");
	});
});

describe("computeOutboxRetryDelayMs", () => {
	const policy: OutboxRetryPolicy = { maxAttempts: 8, baseDelayMs: 1_000, maxDelayMs: 10_000, jitterRatio: 0.2 };

	it("doubles per attempt", () => {
		expect([1, 2, 3, 4].map((attempt) => computeOutboxRetryDelayMs(policy, attempt, NO_JITTER))).toEqual([1_000, 2_000, 4_000, 8_000]);
	});

	it("caps at maxDelayMs", () => {
		expect(computeOutboxRetryDelayMs(policy, 20, NO_JITTER)).toBe(10_000);
	});

	it("applies at most ±jitterRatio", () => {
		expect(computeOutboxRetryDelayMs(policy, 1, () => 0)).toBe(800);
		expect(computeOutboxRetryDelayMs(policy, 1, () => 0.999_999)).toBe(1_200);
	});
});

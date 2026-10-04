import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	RETENTION_INITIAL_DELAY_MS,
	RETENTION_INTERVAL_MS,
	RETENTION_LOCK_NAMES,
	RETENTION_PURGE_BATCH_SIZE,
	RETENTION_PURGE_POLICY,
	RETENTION_PURGE_TIME_BUDGET_MS,
	RetentionScheduler,
	runLedgerRetention,
	type LockedBatch,
	type RetentionDeps,
	type RetentionLedger,
	type RetentionStore,
} from "./inbox-retention";
import type { ConsumerLogEntry, ConsumerLogger } from "./message-handler";

const NOW_MS = 1_790_812_800_000;
const MS_PER_DAY = 86_400_000;
const INBOX_RETENTION_DAYS = 14;
const DEAD_LETTER_RETENTION_DAYS = 30;
const INBOX_CUTOFF_MS: number = NOW_MS - INBOX_RETENTION_DAYS * MS_PER_DAY;
const DEAD_LETTER_CUTOFF_MS: number = NOW_MS - DEAD_LETTER_RETENTION_DAYS * MS_PER_DAY;
const CONSUMER = "analytics-warehouse";

interface PurgeCall {
	readonly ledger: RetentionLedger;
	readonly consumer: string;
	readonly cutoffEpochMs: number;
	readonly batchSize: number;
}

/**
 * In-memory ledgers with the same contract as `PgInboxStore.purgeBatch`:
 * every batch takes the ledger's lock for its own transaction only.
 * `lockHeldElsewhereFromBatch` simulates another instance grabbing the lock
 * before the n-th batch (1-based).
 */
class InMemoryRetentionStore implements RetentionStore {
	public readonly calls: PurgeCall[] = [];
	public lockHeldElsewhereFromBatch: number | null = null;
	public msPerBatch = 0;
	public failWith: Error | undefined;

	public constructor(
		public readonly rows: Record<RetentionLedger, number[]>,
		private readonly _clock: { now: number },
	) {}

	public purgeBatch(ledger: RetentionLedger, consumer: string, cutoffEpochMs: number, batchSize: number): Promise<LockedBatch> {
		if (this.failWith !== undefined) {
			return Promise.reject(this.failWith);
		}
		this.calls.push({ ledger, consumer, cutoffEpochMs, batchSize });
		if (this.lockHeldElsewhereFromBatch !== null && this.calls.filter((call: PurgeCall): boolean => call.ledger === ledger).length >= this.lockHeldElsewhereFromBatch) {
			return Promise.resolve({ acquired: false });
		}
		this._clock.now += this.msPerBatch;
		const eligible: number[] = this.rows[ledger].filter((at: number): boolean => at < cutoffEpochMs).slice(0, batchSize);
		this.rows[ledger] = this.rows[ledger].filter((at: number): boolean => !eligible.includes(at));
		return Promise.resolve({ acquired: true, deleted: eligible.length });
	}
}

class RecordingLogger implements ConsumerLogger {
	public readonly lines: { readonly level: "info" | "warn" | "error"; readonly entry: ConsumerLogEntry }[] = [];

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

/** `count` distinct timestamps, all older than `cutoff`. */
function olderThan(cutoff: number, count: number): number[] {
	return Array.from({ length: count }, (_value: number, index: number): number => cutoff - 1 - index);
}

interface Harness {
	readonly store: InMemoryRetentionStore;
	readonly logger: RecordingLogger;
	readonly deps: RetentionDeps;
}

function harness(rows: Partial<Record<RetentionLedger, number[]>>): Harness {
	const clock = { now: NOW_MS };
	const store = new InMemoryRetentionStore({ inbox_claims: rows.inbox_claims ?? [], dead_letters: rows.dead_letters ?? [] }, clock);
	const logger = new RecordingLogger();
	return {
		store,
		logger,
		deps: {
			store,
			logger,
			nowMs: (): number => clock.now,
			consumerId: CONSUMER,
			inboxRetentionDays: INBOX_RETENTION_DAYS,
			deadLetterRetentionDays: DEAD_LETTER_RETENTION_DAYS,
		},
	};
}

describe("runLedgerRetention", () => {
	it("deletes only inbox claims older than the inbox window and keeps newer ones", async () => {
		const recent = [NOW_MS, NOW_MS - MS_PER_DAY, INBOX_CUTOFF_MS];
		const { store, deps } = harness({ inbox_claims: [...recent, ...olderThan(INBOX_CUTOFF_MS, 3)] });

		const outcome = await runLedgerRetention("inbox_claims", deps);

		expect(outcome).toMatchObject({ kind: "completed", ledger: "inbox_claims", deleted: 3, batches: 1, stoppedBy: "drained", cutoffEpochMs: INBOX_CUTOFF_MS });
		expect(store.rows.inbox_claims).toEqual(recent);
		expect(store.calls[0]).toMatchObject({ consumer: CONSUMER });
	});

	it("purges parked messages past the dead-letter window (they are no longer kept forever)", async () => {
		const kept = [NOW_MS - 29 * MS_PER_DAY];
		const { store, deps } = harness({ dead_letters: [...kept, ...olderThan(DEAD_LETTER_CUTOFF_MS, 4)] });

		const outcome = await runLedgerRetention("dead_letters", deps);

		expect(outcome).toMatchObject({ kind: "completed", ledger: "dead_letters", deleted: 4, retentionDays: DEAD_LETTER_RETENTION_DAYS, cutoffEpochMs: DEAD_LETTER_CUTOFF_MS });
		expect(store.rows.dead_letters).toEqual(kept);
	});

	it("deletes in bounded batches with one fixed cutoff until drained", async () => {
		const { store, deps } = harness({ inbox_claims: olderThan(INBOX_CUTOFF_MS, RETENTION_PURGE_BATCH_SIZE * 2 + 1) });

		const outcome = await runLedgerRetention("inbox_claims", deps);

		expect(outcome).toMatchObject({ kind: "completed", deleted: RETENTION_PURGE_BATCH_SIZE * 2 + 1, batches: 3, stoppedBy: "drained" });
		expect(store.calls.map((call: PurgeCall) => [call.cutoffEpochMs, call.batchSize])).toEqual([
			[INBOX_CUTOFF_MS, RETENTION_PURGE_BATCH_SIZE],
			[INBOX_CUTOFF_MS, RETENTION_PURGE_BATCH_SIZE],
			[INBOX_CUTOFF_MS, RETENTION_PURGE_BATCH_SIZE],
		]);
	});

	it("stops at the time budget, warns, and leaves the backlog for the next run", async () => {
		const { store, logger, deps } = harness({ inbox_claims: olderThan(INBOX_CUTOFF_MS, RETENTION_PURGE_BATCH_SIZE * 5) });
		store.msPerBatch = RETENTION_PURGE_TIME_BUDGET_MS / 2;

		const outcome = await runLedgerRetention("inbox_claims", deps);

		expect(outcome).toMatchObject({ kind: "completed", deleted: RETENTION_PURGE_BATCH_SIZE * 2, batches: 2, stoppedBy: "time_budget" });
		expect(store.rows.inbox_claims).toHaveLength(RETENTION_PURGE_BATCH_SIZE * 3);
		expect(logger.lines).toHaveLength(1);
		expect(logger.lines[0]).toMatchObject({ level: "warn", entry: { event: "analytics.retention_summary", ledger: "inbox_claims", stoppedBy: "time_budget" } });
	});

	it("skips without deleting when another instance holds the lock on the first batch", async () => {
		const { store, logger, deps } = harness({ inbox_claims: olderThan(INBOX_CUTOFF_MS, 5) });
		store.lockHeldElsewhereFromBatch = 1;

		await expect(runLedgerRetention("inbox_claims", deps)).resolves.toEqual({ kind: "skipped_locked", ledger: "inbox_claims" });
		expect(store.rows.inbox_claims).toHaveLength(5);
		expect(logger.lines).toEqual([{ level: "info", entry: { event: "analytics.retention_skipped", ledger: "inbox_claims", reason: "lock_held_by_another_instance" } }]);
	});

	it("yields (stops, reporting what it did) when another instance takes the lock between batches", async () => {
		const { store, deps } = harness({ inbox_claims: olderThan(INBOX_CUTOFF_MS, RETENTION_PURGE_BATCH_SIZE * 3) });
		store.lockHeldElsewhereFromBatch = 2;

		const outcome = await runLedgerRetention("inbox_claims", deps);

		expect(outcome).toMatchObject({ kind: "yielded", deleted: RETENTION_PURGE_BATCH_SIZE, batches: 2 });
		expect(store.rows.inbox_claims).toHaveLength(RETENTION_PURGE_BATCH_SIZE * 2);
	});

	it("propagates a database failure (the scheduler logs it and retries next tick)", async () => {
		const { store, deps } = harness({ inbox_claims: olderThan(INBOX_CUTOFF_MS, 1) });
		store.failWith = new Error("connection lost");

		await expect(runLedgerRetention("inbox_claims", deps)).rejects.toThrow("connection lost");
	});

	it("uses a bounded batch, a time budget far below the interval, and one lock per ledger", () => {
		expect(RETENTION_PURGE_POLICY).toEqual({ batchSize: RETENTION_PURGE_BATCH_SIZE, timeBudgetMs: RETENTION_PURGE_TIME_BUDGET_MS });
		expect(RETENTION_PURGE_TIME_BUDGET_MS).toBeLessThan(RETENTION_INTERVAL_MS);
		expect(new Set(Object.values(RETENTION_LOCK_NAMES)).size).toBe(2);
	});
});

describe("RetentionScheduler", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("first runs both ledgers after the initial delay, then once per interval", async () => {
		const { store, deps } = harness({});
		const scheduler = new RetentionScheduler(deps);

		scheduler.start();
		await vi.advanceTimersByTimeAsync(RETENTION_INITIAL_DELAY_MS - 1);
		expect(store.calls).toHaveLength(0);

		await vi.advanceTimersByTimeAsync(1);
		expect(store.calls.map((call: PurgeCall) => call.ledger)).toEqual(["inbox_claims", "dead_letters"]);

		await vi.advanceTimersByTimeAsync(RETENTION_INTERVAL_MS);
		expect(store.calls).toHaveLength(4);

		await scheduler.stop();
	});

	it("logs a failed run per ledger and keeps the schedule alive (retention never crashes the consumer)", async () => {
		const { store, logger, deps } = harness({ inbox_claims: olderThan(INBOX_CUTOFF_MS, 1) });
		store.failWith = new Error("connection lost");
		const scheduler = new RetentionScheduler(deps);

		scheduler.start();
		await vi.advanceTimersByTimeAsync(RETENTION_INITIAL_DELAY_MS);
		expect(logger.lines).toEqual([
			{ level: "error", entry: { event: "analytics.retention_failed", ledger: "inbox_claims", error: "connection lost" } },
			{ level: "error", entry: { event: "analytics.retention_failed", ledger: "dead_letters", error: "connection lost" } },
		]);

		store.failWith = undefined;
		await vi.advanceTimersByTimeAsync(RETENTION_INTERVAL_MS);
		expect(store.rows.inbox_claims).toEqual([]);

		await scheduler.stop();
	});

	it("stops scheduling after stop()", async () => {
		const { store, deps } = harness({});
		const scheduler = new RetentionScheduler(deps);

		scheduler.start();
		await scheduler.stop();
		await vi.advanceTimersByTimeAsync(RETENTION_INITIAL_DELAY_MS + RETENTION_INTERVAL_MS * 2);

		expect(store.calls).toHaveLength(0);
	});
});

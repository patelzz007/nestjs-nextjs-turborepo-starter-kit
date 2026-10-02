import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	INBOX_PURGE_BATCH_SIZE,
	INBOX_PURGE_POLICY,
	INBOX_PURGE_TIME_BUDGET_MS,
	INBOX_RETENTION_INITIAL_DELAY_MS,
	INBOX_RETENTION_INTERVAL_MS,
	InboxRetentionScheduler,
	runInboxRetention,
	type InboxRetentionDeps,
	type InboxRetentionStore,
	type LockedRun,
} from "./inbox-retention";
import type { ConsumerLogEntry, ConsumerLogger } from "./message-handler";

const NOW_MS = 1_790_812_800_000;
const MS_PER_DAY = 86_400_000;
const RETENTION_DAYS = 14;
const CUTOFF_MS: number = NOW_MS - RETENTION_DAYS * MS_PER_DAY;

/** In-memory `inbox_processed_events.processed_at` column + advisory lock, with the same contract as `PgInboxStore`. */
class InMemoryRetentionStore implements InboxRetentionStore {
	public readonly deleteCalls: { readonly cutoffEpochMs: number; readonly batchSize: number }[] = [];
	public lockHeldElsewhere = false;
	public lockAcquisitions = 0;
	public lockHeld = false;
	public msPerBatch = 0;
	public failWith: Error | undefined;

	public constructor(
		public processedAt: number[],
		private readonly _clock: { now: number },
	) {}

	public async withRetentionLock<T>(work: () => Promise<T>): Promise<LockedRun<T>> {
		if (this.lockHeldElsewhere) {
			return { acquired: false };
		}
		this.lockAcquisitions += 1;
		this.lockHeld = true;
		try {
			return { acquired: true, result: await work() };
		} finally {
			this.lockHeld = false;
		}
	}

	public deleteProcessedBefore(cutoffEpochMs: number, batchSize: number): Promise<number> {
		if (!this.lockHeld) {
			return Promise.reject(new Error("deleted without holding the retention lock"));
		}
		if (this.failWith !== undefined) {
			return Promise.reject(this.failWith);
		}
		this.deleteCalls.push({ cutoffEpochMs, batchSize });
		this._clock.now += this.msPerBatch;
		const eligible: number[] = this.processedAt.filter((at: number): boolean => at < cutoffEpochMs).slice(0, batchSize);
		this.processedAt = this.processedAt.filter((at: number): boolean => !eligible.includes(at));
		return Promise.resolve(eligible.length);
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

/** `count` distinct timestamps, all older than the retention cutoff. */
function older(count: number): number[] {
	return Array.from({ length: count }, (_value: number, index: number): number => CUTOFF_MS - 1 - index);
}

function harness(processedAt: number[]): { store: InMemoryRetentionStore; logger: RecordingLogger; deps: InboxRetentionDeps; clock: { now: number } } {
	const clock = { now: NOW_MS };
	const store = new InMemoryRetentionStore(processedAt, clock);
	const logger = new RecordingLogger();
	return { store, logger, clock, deps: { store, logger, nowMs: (): number => clock.now, retentionDays: RETENTION_DAYS } };
}

describe("runInboxRetention", () => {
	it("deletes only claims older than the retention window and keeps newer ones", async () => {
		const recent = [NOW_MS, NOW_MS - MS_PER_DAY, CUTOFF_MS];
		const { store, deps } = harness([...recent, ...older(3)]);

		const outcome = await runInboxRetention(deps);

		expect(outcome).toMatchObject({ kind: "completed", deleted: 3, batches: 1, stoppedBy: "drained", cutoffEpochMs: CUTOFF_MS });
		expect(store.processedAt).toEqual(recent);
	});

	it("deletes in bounded batches with one fixed cutoff until drained, all under one lock", async () => {
		const { store, deps } = harness(older(INBOX_PURGE_BATCH_SIZE * 2 + 1));

		const outcome = await runInboxRetention(deps);

		expect(outcome).toMatchObject({ kind: "completed", deleted: INBOX_PURGE_BATCH_SIZE * 2 + 1, batches: 3, stoppedBy: "drained" });
		expect(store.deleteCalls).toEqual([
			{ cutoffEpochMs: CUTOFF_MS, batchSize: INBOX_PURGE_BATCH_SIZE },
			{ cutoffEpochMs: CUTOFF_MS, batchSize: INBOX_PURGE_BATCH_SIZE },
			{ cutoffEpochMs: CUTOFF_MS, batchSize: INBOX_PURGE_BATCH_SIZE },
		]);
		expect(store.lockAcquisitions).toBe(1);
	});

	it("stops at the time budget, warns, and leaves the backlog for the next run", async () => {
		const { store, logger, deps } = harness(older(INBOX_PURGE_BATCH_SIZE * 5));
		store.msPerBatch = INBOX_PURGE_TIME_BUDGET_MS / 2;

		const outcome = await runInboxRetention(deps);

		expect(outcome).toMatchObject({ kind: "completed", deleted: INBOX_PURGE_BATCH_SIZE * 2, batches: 2, stoppedBy: "time_budget" });
		expect(store.processedAt).toHaveLength(INBOX_PURGE_BATCH_SIZE * 3);
		expect(logger.lines).toHaveLength(1);
		expect(logger.lines[0]?.level).toBe("warn");
		expect(logger.lines[0]?.entry).toMatchObject({ event: "analytics.inbox_retention_summary", stoppedBy: "time_budget", retentionDays: RETENTION_DAYS });
	});

	it("skips without deleting when another consumer instance holds the lock", async () => {
		const { store, logger, deps } = harness(older(5));
		store.lockHeldElsewhere = true;

		await expect(runInboxRetention(deps)).resolves.toEqual({ kind: "skipped_locked" });
		expect(store.deleteCalls).toEqual([]);
		expect(store.processedAt).toHaveLength(5);
		expect(logger.lines).toEqual([{ level: "info", entry: { event: "analytics.inbox_retention_skipped", reason: "lock_held_by_another_instance" } }]);
	});

	it("logs one structured summary line for a completed run", async () => {
		const { logger, deps } = harness(older(2));

		await runInboxRetention(deps);

		expect(logger.lines).toEqual([
			{
				level: "info",
				entry: {
					event: "analytics.inbox_retention_summary",
					retentionDays: RETENTION_DAYS,
					cutoffEpochMs: CUTOFF_MS,
					deleted: 2,
					batches: 1,
					durationMs: 0,
					stoppedBy: "drained",
				},
			},
		]);
	});

	it("propagates a database failure (the scheduler logs it and retries next tick)", async () => {
		const { store, deps } = harness(older(1));
		store.failWith = new Error("connection lost");

		await expect(runInboxRetention(deps)).rejects.toThrow("connection lost");
		expect(store.lockHeld).toBe(false);
	});

	it("uses a bounded batch and a time budget far below the interval", () => {
		expect(INBOX_PURGE_POLICY).toEqual({ batchSize: INBOX_PURGE_BATCH_SIZE, timeBudgetMs: INBOX_PURGE_TIME_BUDGET_MS });
		expect(INBOX_PURGE_TIME_BUDGET_MS).toBeLessThan(INBOX_RETENTION_INTERVAL_MS);
	});
});

describe("InboxRetentionScheduler", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("first runs after the initial delay, then once per interval", async () => {
		const { store, deps } = harness([]);
		const scheduler = new InboxRetentionScheduler(deps);

		scheduler.start();
		await vi.advanceTimersByTimeAsync(INBOX_RETENTION_INITIAL_DELAY_MS - 1);
		expect(store.lockAcquisitions).toBe(0);

		await vi.advanceTimersByTimeAsync(1);
		expect(store.lockAcquisitions).toBe(1);

		await vi.advanceTimersByTimeAsync(INBOX_RETENTION_INTERVAL_MS);
		expect(store.lockAcquisitions).toBe(2);

		await scheduler.stop();
	});

	it("logs a failed run and keeps the schedule alive (retention never crashes the consumer)", async () => {
		const { store, logger, deps } = harness(older(1));
		store.failWith = new Error("connection lost");
		const scheduler = new InboxRetentionScheduler(deps);

		scheduler.start();
		await vi.advanceTimersByTimeAsync(INBOX_RETENTION_INITIAL_DELAY_MS);
		expect(logger.lines).toEqual([{ level: "error", entry: { event: "analytics.inbox_retention_failed", error: "connection lost" } }]);

		store.failWith = undefined;
		await vi.advanceTimersByTimeAsync(INBOX_RETENTION_INTERVAL_MS);
		expect(store.processedAt).toEqual([]);

		await scheduler.stop();
	});

	it("stops scheduling after stop()", async () => {
		const { store, deps } = harness([]);
		const scheduler = new InboxRetentionScheduler(deps);

		scheduler.start();
		await scheduler.stop();
		await vi.advanceTimersByTimeAsync(INBOX_RETENTION_INITIAL_DELAY_MS + INBOX_RETENTION_INTERVAL_MS * 2);

		expect(store.lockAcquisitions).toBe(0);
	});
});

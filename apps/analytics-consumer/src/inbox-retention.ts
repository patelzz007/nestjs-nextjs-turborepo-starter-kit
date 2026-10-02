import { purgeInBatches, type BatchedPurgePolicy, type BatchedPurgeResult } from "@workspace/shared";

import type { ConsumerLogger } from "./message-handler";

/**
 * Session tag (`app.system_operation`) for retention deletes, and the name the
 * cluster-wide advisory lock is derived from. A specific name — not the
 * `analytics.ingest` tag — so an audit/debug trace tells ingest and purge apart.
 */
export const INBOX_RETENTION_OPERATION = "analytics.inbox_retention";

const MS_PER_DAY: number = 24 * 60 * 60 * 1000;

/** Rows per DELETE transaction — keeps each transaction (and its row locks) short. */
export const INBOX_PURGE_BATCH_SIZE = 1_000;

/** Wall-clock budget per run (1 minute); a larger backlog is finished by the next runs. */
export const INBOX_PURGE_TIME_BUDGET_MS: number = 60 * 1000;

export const INBOX_PURGE_POLICY: BatchedPurgePolicy = { batchSize: INBOX_PURGE_BATCH_SIZE, timeBudgetMs: INBOX_PURGE_TIME_BUDGET_MS };

/** Retention cadence (hourly) — the table only needs to stay bounded, not exact. */
export const INBOX_RETENTION_INTERVAL_MS: number = 60 * 60 * 1000;

/** Delay before the first run, so boot (topic creation, subscribe, rebalance) is not competing with it. */
export const INBOX_RETENTION_INITIAL_DELAY_MS: number = 60 * 1000;

/** Result of trying to run under the cluster-wide retention lock. */
export type LockedRun<T> = { readonly acquired: true; readonly result: T } | { readonly acquired: false };

/** Persistence port for inbox retention (implemented by `PgInboxStore`). */
export interface InboxRetentionStore {
	/**
	 * Run `work` only while holding the cluster-wide retention lock (a
	 * Postgres advisory lock). Returns `{ acquired: false }` without running
	 * `work` when another consumer instance holds it.
	 */
	withRetentionLock<T>(work: () => Promise<T>): Promise<LockedRun<T>>;
	/** Delete up to `batchSize` inbox claims processed before `cutoffEpochMs`; returns how many were deleted. */
	deleteProcessedBefore(cutoffEpochMs: number, batchSize: number): Promise<number>;
}

export interface InboxRetentionDeps {
	readonly store: InboxRetentionStore;
	readonly logger: ConsumerLogger;
	readonly nowMs: () => number;
	/** `INBOX_RETENTION_DAYS` — must exceed the Kafka redelivery horizon (see env.ts). */
	readonly retentionDays: number;
}

export type InboxRetentionOutcome = ({ readonly kind: "completed"; readonly cutoffEpochMs: number } & BatchedPurgeResult) | { readonly kind: "skipped_locked" };

/**
 * One retention pass over `inbox_processed_events`: deletes claims older than
 * the retention window in bounded batches, under the advisory lock so at most
 * one consumer instance purges at a time. Logs one summary line.
 * `inbox_dead_letters` is never touched — parked messages are operator work
 * items, deleted by hand once handled (docs/infrastructure/messaging.md).
 */
export async function runInboxRetention(deps: InboxRetentionDeps): Promise<InboxRetentionOutcome> {
	const cutoffEpochMs: number = deps.nowMs() - deps.retentionDays * MS_PER_DAY;

	const run: LockedRun<BatchedPurgeResult> = await deps.store.withRetentionLock((): Promise<BatchedPurgeResult> =>
		purgeInBatches((batchSize: number): Promise<number> => deps.store.deleteProcessedBefore(cutoffEpochMs, batchSize), INBOX_PURGE_POLICY, deps.nowMs),
	);

	if (!run.acquired) {
		deps.logger.info({ event: "analytics.inbox_retention_skipped", reason: "lock_held_by_another_instance" });
		return { kind: "skipped_locked" };
	}

	const outcome: InboxRetentionOutcome = { kind: "completed", cutoffEpochMs, ...run.result };
	const entry = { event: "analytics.inbox_retention_summary", retentionDays: deps.retentionDays, cutoffEpochMs, ...run.result };
	if (run.result.stoppedBy === "time_budget") {
		// Not an error — the next run continues. Repeated warnings mean ingest outpaces one run per interval.
		deps.logger.warn(entry);
	} else {
		deps.logger.info(entry);
	}
	return outcome;
}

/** Timer seam so the schedule is testable with fake timers and no real waiting. */
export interface RetentionTimers {
	setTimeout(callback: () => void, delayMs: number): NodeJS.Timeout;
	clearTimeout(timer: NodeJS.Timeout): void;
}

const NODE_TIMERS: RetentionTimers = {
	setTimeout: (callback: () => void, delayMs: number): NodeJS.Timeout => setTimeout(callback, delayMs),
	clearTimeout: (timer: NodeJS.Timeout): void => {
		clearTimeout(timer);
	},
};

/**
 * Runs {@link runInboxRetention} after an initial delay and then every
 * interval. The next run is scheduled only after the previous one settles,
 * so runs never overlap inside one process (the advisory lock covers other
 * processes). A failed run is logged and retried on the next tick — retention
 * must never crash the consumer.
 */
export class InboxRetentionScheduler {
	private _timer: NodeJS.Timeout | undefined;
	private _inFlight: Promise<void> | undefined;
	private _stopped = false;

	public constructor(
		private readonly _deps: InboxRetentionDeps,
		private readonly _timers: RetentionTimers = NODE_TIMERS,
		private readonly _initialDelayMs: number = INBOX_RETENTION_INITIAL_DELAY_MS,
		private readonly _intervalMs: number = INBOX_RETENTION_INTERVAL_MS,
	) {}

	public start(): void {
		this._stopped = false;
		this.schedule(this._initialDelayMs);
	}

	/** Cancel the next run and wait for an in-flight one to finish (graceful shutdown). */
	public async stop(): Promise<void> {
		this._stopped = true;
		if (this._timer !== undefined) {
			this._timers.clearTimeout(this._timer);
			this._timer = undefined;
		}
		await this._inFlight;
	}

	private schedule(delayMs: number): void {
		if (this._stopped) {
			return;
		}
		this._timer = this._timers.setTimeout((): void => {
			this._timer = undefined;
			this._inFlight = this.runOnce().finally((): void => {
				this._inFlight = undefined;
				this.schedule(this._intervalMs);
			});
		}, delayMs);
	}

	private async runOnce(): Promise<void> {
		try {
			await runInboxRetention(this._deps);
		} catch (error) {
			this._deps.logger.error({ event: "analytics.inbox_retention_failed", error: error instanceof Error ? error.message : String(error) });
		}
	}
}

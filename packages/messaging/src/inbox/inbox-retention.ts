import { purgeInBatches, type BatchedPurgePolicy, type BatchedPurgeResult } from "@workspace/shared";

import type { ConsumerLogger } from "./message-handler";

const MS_PER_DAY: number = 24 * 60 * 60 * 1000;

/** Rows per DELETE transaction — keeps each transaction (and its row locks) short. */
export const RETENTION_PURGE_BATCH_SIZE = 1_000;

/** Wall-clock budget per ledger per run (1 minute); a larger backlog is finished by the next runs. */
export const RETENTION_PURGE_TIME_BUDGET_MS: number = 60 * 1000;

export const RETENTION_PURGE_POLICY: BatchedPurgePolicy = { batchSize: RETENTION_PURGE_BATCH_SIZE, timeBudgetMs: RETENTION_PURGE_TIME_BUDGET_MS };

/** Retention cadence (hourly) — the tables only need to stay bounded, not exact. */
export const RETENTION_INTERVAL_MS: number = 60 * 60 * 1000;

/** Delay before the first run, so boot (subscribe, rebalance) is not competing with it. */
export const RETENTION_INITIAL_DELAY_MS: number = 60 * 1000;

/** The two ledgers the consumer owns and purges. */
export type RetentionLedger = "inbox_claims" | "dead_letters";

export const RETENTION_LEDGERS: [RetentionLedger, RetentionLedger] = ["inbox_claims", "dead_letters"];

/**
 * Name each ledger's cluster-wide advisory lock is derived from
 * (`pg_try_advisory_xact_lock(hashtextextended(name, 0))`).
 */
export const RETENTION_LOCK_NAMES: Readonly<Record<RetentionLedger, string>> = {
	inbox_claims: "analytics.inbox_retention",
	dead_letters: "analytics.dead_letter_retention",
};

/** One purge batch: `acquired: false` when another instance holds the ledger's lock (nothing was deleted). */
export type LockedBatch = { readonly acquired: true; readonly deleted: number } | { readonly acquired: false };

/** Persistence port for retention (implemented by `PgInboxStore`). */
export interface RetentionStore {
	/**
	 * In ONE transaction: take the ledger's transaction-level advisory lock
	 * without waiting, and — only if it was free — delete up to `batchSize` of
	 * `consumer`'s rows older than `cutoffEpochMs`, oldest first. The lock is
	 * released by the commit, so it is safe behind a transaction pooler.
	 */
	purgeBatch(ledger: RetentionLedger, consumer: string, cutoffEpochMs: number, batchSize: number): Promise<LockedBatch>;
}

export interface RetentionDeps {
	readonly store: RetentionStore;
	readonly logger: ConsumerLogger;
	readonly nowMs: () => number;
	readonly consumerId: string;
	/** `ANALYTICS_INBOX_RETENTION_DAYS` — must exceed the topic retention (validated in env.ts). */
	readonly inboxRetentionDays: number;
	/** `ANALYTICS_DEAD_LETTER_RETENTION_DAYS`. */
	readonly deadLetterRetentionDays: number;
}

/**
 * - `completed`: the run drained the window or hit its time budget;
 * - `skipped_locked`: another instance held the lock on the first batch — nothing deleted;
 * - `yielded`: another instance took the lock between two batches and continues the purge.
 */
export type RetentionOutcome =
	| ({ readonly kind: "completed"; readonly ledger: RetentionLedger; readonly retentionDays: number; readonly cutoffEpochMs: number } & BatchedPurgeResult)
	| ({ readonly kind: "yielded"; readonly ledger: RetentionLedger; readonly retentionDays: number; readonly cutoffEpochMs: number } & BatchedPurgeResult)
	| { readonly kind: "skipped_locked"; readonly ledger: RetentionLedger };

function retentionDaysFor(ledger: RetentionLedger, deps: RetentionDeps): number {
	return ledger === "inbox_claims" ? deps.inboxRetentionDays : deps.deadLetterRetentionDays;
}

/**
 * One retention pass over one ledger, in bounded batches (one short
 * transaction each, each under the ledger's advisory lock). Logs one summary line.
 */
export async function runLedgerRetention(ledger: RetentionLedger, deps: RetentionDeps): Promise<RetentionOutcome> {
	const retentionDays: number = retentionDaysFor(ledger, deps);
	const cutoffEpochMs: number = deps.nowMs() - retentionDays * MS_PER_DAY;
	const lock: { lost: boolean } = { lost: false };

	const result: BatchedPurgeResult = await purgeInBatches(
		async (batchSize: number): Promise<number> => {
			const batch = await deps.store.purgeBatch(ledger, deps.consumerId, cutoffEpochMs, batchSize);
			if (!batch.acquired) {
				// Another instance is purging this ledger right now: stop here (0 < batchSize ends the loop).
				lock.lost = true;
				return 0;
			}
			return batch.deleted;
		},
		RETENTION_PURGE_POLICY,
		deps.nowMs,
	);

	if (lock.lost && result.batches === 1) {
		deps.logger.info({ event: "analytics.retention_skipped", ledger, reason: "lock_held_by_another_instance" });
		return { kind: "skipped_locked", ledger };
	}

	const kind = lock.lost ? "yielded" : "completed";
	const entry = { event: "analytics.retention_summary", ledger, outcome: kind, retentionDays, cutoffEpochMs, ...result };
	if (result.stoppedBy === "time_budget") {
		// Not an error — the next run continues. Repeated warnings mean the ledger grows faster than one run per interval drains it.
		deps.logger.warn(entry);
	} else {
		deps.logger.info(entry);
	}
	return { kind, ledger, retentionDays, cutoffEpochMs, ...result };
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
 * Runs {@link runLedgerRetention} for every ledger after an initial delay and
 * then every interval. The next run is scheduled only after the previous one
 * settles, so runs never overlap inside one process (the advisory locks cover
 * other processes). A failed ledger run is logged and retried on the next
 * tick, and never prevents the other ledger's run — retention must never
 * crash the consumer.
 */
export class RetentionScheduler {
	private _timer: NodeJS.Timeout | undefined;
	private _inFlight: Promise<void> | undefined;
	private _stopped = false;

	public constructor(
		private readonly _deps: RetentionDeps,
		private readonly _timers: RetentionTimers = NODE_TIMERS,
		private readonly _initialDelayMs: number = RETENTION_INITIAL_DELAY_MS,
		private readonly _intervalMs: number = RETENTION_INTERVAL_MS,
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
		for (const ledger of RETENTION_LEDGERS) {
			try {
				await runLedgerRetention(ledger, this._deps);
			} catch (error) {
				this._deps.logger.error({ event: "analytics.retention_failed", ledger, error: error instanceof Error ? error.message : String(error) });
			}
		}
	}
}

import { purgeInBatches, type BatchedPurgeResult } from "@workspace/shared";

import { compareVariants, type VariantComparison, type VariantSums } from "./experiment-statistics";
import { RETENTION_INITIAL_DELAY_MS, RETENTION_INTERVAL_MS, RETENTION_PURGE_POLICY, type LockedBatch, type RetentionTimers } from "./inbox-retention";
import type { ConsumerLogger } from "./message-handler";

// ── Feature flag analytics (ADR 087) ─────────────────────────────────────────────────────────────
// Hourly, one instance at a time (advisory locks): exposures and metric occurrences past 90 days are purged, today's
// and yesterday's exposure sums are rewritten, and every running (or just stopped) experiment's results are worked
// out again from its exposed subjects and their metric occurrences.

const MS_PER_DAY = 86_400_000;
/** Raw exposures and metric occurrences are kept 90 days; the daily sums stay. */
export const FLAG_ANALYTICS_RETENTION_DAYS = 90;
/** The days whose sums each run rewrites: today and yesterday (a late event lands in either). */
export const FLAG_ROLLUP_DAYS = 2;
/** A stopped experiment's results are worked out once more for a day after it stops. */
export const STOPPED_EXPERIMENT_GRACE_MS = MS_PER_DAY;

export type FlagAnalyticsLedger = "flag_exposures" | "experiment_metric_events";

export const FLAG_ANALYTICS_LOCK_NAMES: Readonly<Record<FlagAnalyticsLedger | "rollup" | "results", string>> = {
	flag_exposures: "analytics.flag_exposure_retention",
	experiment_metric_events: "analytics.experiment_metric_retention",
	rollup: "analytics.flag_exposure_rollup",
	results: "analytics.experiment_results",
};

/** An experiment whose results are worked out (running, or stopped within the grace). */
export interface ResultExperiment {
	readonly id: string;
	readonly controlValueName: string;
	readonly metrics: readonly string[];
	readonly from: number;
	readonly until: number;
}

export interface ExperimentResultRow extends VariantComparison {
	readonly metric: string;
}

/** Persistence port of the flag analytics (implemented by `PgFlagAnalyticsStore`). */
export interface FlagAnalyticsStore {
	/** One bounded purge batch of a flag analytics ledger under its lock. */
	flagPurgeBatch(ledger: FlagAnalyticsLedger, cutoffEpochMs: number, batchSize: number): Promise<LockedBatch>;
	/** Rewrites one day's sums under the rollup lock; false when another instance holds it. */
	rollupDay(dayStart: number): Promise<boolean>;
	experimentsToCompute(now: number, stoppedGraceMs: number): Promise<readonly ResultExperiment[]>;
	variantSums(experimentId: string, metric: string, from: number, until: number): Promise<readonly VariantSums[]>;
	/** Upserts one experiment's rows under the results lock; false when another instance holds it. */
	saveResults(experimentId: string, rows: readonly ExperimentResultRow[], computedAt: number): Promise<boolean>;
}

export interface FlagAnalyticsDeps {
	readonly store: FlagAnalyticsStore;
	readonly logger: ConsumerLogger;
	readonly nowMs: () => number;
}

export interface FlagAnalyticsOutcome {
	readonly purged: Readonly<Record<FlagAnalyticsLedger, BatchedPurgeResult>>;
	readonly rolledUpDays: number;
	readonly experiments: number;
}

function purge(ledger: FlagAnalyticsLedger, deps: FlagAnalyticsDeps): Promise<BatchedPurgeResult> {
	const cutoff = deps.nowMs() - FLAG_ANALYTICS_RETENTION_DAYS * MS_PER_DAY;
	return purgeInBatches(
		async (batchSize: number): Promise<number> => {
			const batch = await deps.store.flagPurgeBatch(ledger, cutoff, batchSize);
			return batch.acquired ? batch.deleted : 0;
		},
		RETENTION_PURGE_POLICY,
		deps.nowMs,
	);
}

/** One full pass. Each step takes its own lock, so two instances never repeat each other's work. */
export async function runFlagAnalytics(deps: FlagAnalyticsDeps): Promise<FlagAnalyticsOutcome> {
	const now = deps.nowMs();
	const purged = { flag_exposures: await purge("flag_exposures", deps), experiment_metric_events: await purge("experiment_metric_events", deps) };
	const today = Math.floor(now / MS_PER_DAY) * MS_PER_DAY;
	let rolledUpDays = 0;
	for (let back = 0; back < FLAG_ROLLUP_DAYS; back += 1) {
		if (await deps.store.rollupDay(today - back * MS_PER_DAY)) {
			rolledUpDays += 1;
		}
	}
	const experiments = await deps.store.experimentsToCompute(now, STOPPED_EXPERIMENT_GRACE_MS);
	for (const experiment of experiments) {
		const rows: ExperimentResultRow[] = [];
		for (const metric of experiment.metrics) {
			const sums = await deps.store.variantSums(experiment.id, metric, experiment.from, experiment.until);
			rows.push(...compareVariants(experiment.controlValueName, sums).map((comparison) => ({ ...comparison, metric })));
		}
		await deps.store.saveResults(experiment.id, rows, now);
	}
	deps.logger.info({
		event: "analytics.flag_analytics_summary",
		rolledUpDays,
		experiments: experiments.length,
		exposuresPurged: purged.flag_exposures.deleted,
		metricEventsPurged: purged.experiment_metric_events.deleted,
	});
	return { purged, rolledUpDays, experiments: experiments.length };
}

const NODE_TIMERS: RetentionTimers = {
	setTimeout: (callback: () => void, delayMs: number): NodeJS.Timeout => setTimeout(callback, delayMs),
	clearTimeout: (timer: NodeJS.Timeout): void => {
		clearTimeout(timer);
	},
};

/** Runs {@link runFlagAnalytics} hourly (first run a minute after boot); `stop()` waits for a run in progress. */
export class FlagAnalyticsScheduler {
	private _timer: NodeJS.Timeout | null = null;
	private _running: Promise<void> | null = null;
	private _stopped = false;

	public constructor(
		private readonly _deps: FlagAnalyticsDeps,
		private readonly _timers: RetentionTimers = NODE_TIMERS,
	) {}

	public start(): void {
		this.schedule(RETENTION_INITIAL_DELAY_MS);
	}

	public async stop(): Promise<void> {
		this._stopped = true;
		if (this._timer !== null) {
			this._timers.clearTimeout(this._timer);
			this._timer = null;
		}
		await this._running;
	}

	private schedule(delayMs: number): void {
		if (this._stopped) {
			return;
		}
		this._timer = this._timers.setTimeout((): void => {
			this._running = this.tick();
		}, delayMs);
	}

	private async tick(): Promise<void> {
		try {
			await runFlagAnalytics(this._deps);
		} catch (error) {
			this._deps.logger.error({ event: "analytics.flag_analytics_failed", error: error instanceof Error ? error.message : String(error) });
		} finally {
			this._running = null;
			this.schedule(RETENTION_INTERVAL_MS);
		}
	}
}

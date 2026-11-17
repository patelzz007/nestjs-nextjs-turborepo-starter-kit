import { epochMs, type PlatformEventMessage } from "@workspace/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { compareVariants, MIN_SUBJECTS_PER_ARM, sampleVariance, type VariantSums } from "../experiment-statistics";
import {
	FLAG_ANALYTICS_RETENTION_DAYS,
	FLAG_ROLLUP_DAYS,
	FlagAnalyticsScheduler,
	runFlagAnalytics,
	type ExperimentResultRow,
	type FlagAnalyticsLedger,
	type FlagAnalyticsStore,
	type ResultExperiment,
} from "../flag-analytics";
import { exposureRowsOf, metricRowsOf } from "../flag-projections";
import { RETENTION_INITIAL_DELAY_MS, RETENTION_INTERVAL_MS, type LockedBatch } from "../inbox-retention";
import type { ConsumerLogEntry, ConsumerLogger } from "../message-handler";

const EVENT_ID = "0b8f5a52-6a3c-4c3e-9d8e-5d8b5f0f4a11";
const USER_ID = "5c1f7a9e-2b4d-4e8f-a1b2-c3d4e5f60718";
const RULE_ID = "019b76da-a800-7000-8000-0000000000a1";
const EXPERIMENT_ID = "019b76da-a800-7000-8000-0000000000e1";
const NOW = 1_800_000_000_000;
const MS_PER_DAY = 86_400_000;

function clock(): number {
	return NOW;
}

const EXPOSURE_EVENT: PlatformEventMessage = {
	eventId: EVENT_ID,
	type: "feature_flag.exposure",
	correlationId: null,
	occurredAt: NOW,
	payload: {
		app: "web",
		exposures: [
			{ kind: "FLAG", key: "web-activity", on: true, source: "RULE", revision: 2, ruleId: RULE_ID, at: epochMs(NOW), subjectUnit: "USER", subjectId: USER_ID },
			{
				kind: "CONFIG",
				key: "reward-claim-cta",
				valueName: null,
				source: "EXPERIMENT",
				revision: 1,
				ruleId: null,
				experimentId: EXPERIMENT_ID,
				variant: "bold",
				at: epochMs(NOW),
				subjectUnit: "USER",
				subjectId: USER_ID,
			},
		],
	},
};

describe("flag projections", () => {
	it("turns an exposure batch into one row per exposure, keyed by its place in the batch", () => {
		expect(exposureRowsOf(EXPOSURE_EVENT)).toMatchObject([
			{ eventId: EVENT_ID, position: 0, kind: "FLAG", value: "on", ruleId: RULE_ID, experimentId: null },
			{ eventId: EVENT_ID, position: 1, kind: "CONFIG", value: "default", experimentId: EXPERIMENT_ID, variant: "bold" },
		]);
		expect(metricRowsOf(EXPOSURE_EVENT)).toStrictEqual([]);
	});

	it("projects a claim, and a successful sign-in, as metric occurrences of their person", () => {
		const claim: PlatformEventMessage = {
			eventId: EVENT_ID,
			type: "reward.platform",
			correlationId: null,
			occurredAt: NOW,
			payload: { event: "user.claim_reward", actorUserId: USER_ID, tenantId: null, metadata: {} },
		};
		expect(metricRowsOf(claim)).toStrictEqual([{ eventId: EVENT_ID, metric: "reward-claims", userId: USER_ID, occurredAt: NOW }]);
		const signIn: PlatformEventMessage = {
			eventId: EVENT_ID,
			type: "auth.flow",
			correlationId: null,
			occurredAt: NOW,
			payload: { flow: "login", userId: USER_ID, clientType: "web", status: "succeeded", error: null, durationMs: 12 },
		};
		expect(metricRowsOf(signIn)).toMatchObject([{ metric: "sign-ins" }]);
		const failed: PlatformEventMessage = { ...signIn, payload: { ...signIn.payload, status: "failed", error: "INVALID_CREDENTIALS" } };
		expect(metricRowsOf(failed)).toStrictEqual([]);
		expect(exposureRowsOf(claim)).toStrictEqual([]);
	});
});

describe("experiment statistics", () => {
	const control: VariantSums = { valueName: "standard", subjects: 100, total: 100, totalSquares: 200 };

	it("works out the sample variance, none with fewer than two subjects", () => {
		expect(sampleVariance(control)).toBeCloseTo(1.0101, 3);
		expect(sampleVariance({ ...control, subjects: MIN_SUBJECTS_PER_ARM - 1 })).toBeNull();
	});

	it("compares each variant with the control and marks an interval that excludes zero", () => {
		const [standard, bold] = compareVariants("standard", [control, { valueName: "bold", subjects: 100, total: 200, totalSquares: 600 }]);
		expect(standard).toMatchObject({ valueName: "standard", mean: 1, delta: null, significant: false });
		expect(bold).toMatchObject({ valueName: "bold", mean: 2, delta: 1, significant: true });
		expect(bold?.ciLow).toBeGreaterThan(0);
		const [, same] = compareVariants("standard", [control, { ...control, valueName: "bold" }]);
		expect(same).toMatchObject({ delta: 0, significant: false });
		expect(compareVariants("missing", [control])).toMatchObject([{ delta: null }]);
	});
});

class RecordingStore implements FlagAnalyticsStore {
	public readonly purged: FlagAnalyticsLedger[] = [];
	public readonly days: number[] = [];
	public readonly saved: { readonly experimentId: string; readonly rows: readonly ExperimentResultRow[] }[] = [];
	public cutoff = 0;
	/** Another instance holds every lock. */
	public lockHeld = false;
	/** The store can't be reached. */
	public failWith: Error | undefined = undefined;

	public flagPurgeBatch(ledger: FlagAnalyticsLedger, cutoffEpochMs: number): Promise<LockedBatch> {
		if (this.failWith !== undefined) {
			return Promise.reject(this.failWith);
		}
		this.purged.push(ledger);
		this.cutoff = cutoffEpochMs;
		return Promise.resolve(this.lockHeld ? { acquired: false } : { acquired: true, deleted: 0 });
	}

	public rollupDay(dayStart: number): Promise<boolean> {
		this.days.push(dayStart);
		return Promise.resolve(!this.lockHeld);
	}

	public experimentsToCompute(): Promise<readonly ResultExperiment[]> {
		return Promise.resolve([{ id: EXPERIMENT_ID, controlValueName: "standard", metrics: ["reward-claims", "sign-ins"], from: NOW - MS_PER_DAY, until: NOW }]);
	}

	public variantSums(): Promise<readonly VariantSums[]> {
		return Promise.resolve([
			{ valueName: "standard", subjects: 10, total: 10, totalSquares: 20 },
			{ valueName: "bold", subjects: 10, total: 20, totalSquares: 60 },
		]);
	}

	public saveResults(experimentId: string, rows: readonly ExperimentResultRow[]): Promise<boolean> {
		this.saved.push({ experimentId, rows });
		return Promise.resolve(true);
	}
}

describe("runFlagAnalytics", () => {
	it("purges past 90 days, rewrites today's and yesterday's sums, and saves every experiment's comparisons", async () => {
		const store = new RecordingStore();
		const logged: ConsumerLogEntry[] = [];
		const logger: ConsumerLogger = { info: (entry) => logged.push(entry), warn: (entry) => logged.push(entry), error: (entry) => logged.push(entry) };
		const outcome = await runFlagAnalytics({ store, logger, nowMs: clock });
		expect(store.purged).toStrictEqual(["flag_exposures", "experiment_metric_events"]);
		expect(store.cutoff).toBe(NOW - FLAG_ANALYTICS_RETENTION_DAYS * MS_PER_DAY);
		const today = Math.floor(NOW / MS_PER_DAY) * MS_PER_DAY;
		expect(store.days).toStrictEqual([today, today - MS_PER_DAY]);
		expect(outcome).toMatchObject({ rolledUpDays: FLAG_ROLLUP_DAYS, experiments: 1 });
		expect(store.saved.at(0)?.rows.map((row) => [row.metric, row.valueName])).toStrictEqual([
			["reward-claims", "standard"],
			["reward-claims", "bold"],
			["sign-ins", "standard"],
			["sign-ins", "bold"],
		]);
		expect(logged).toMatchObject([{ event: "analytics.flag_analytics_summary", experiments: 1 }]);
	});

	it("counts nothing purged, and no day rolled up, while another instance holds the locks", async () => {
		const store = new RecordingStore();
		store.lockHeld = true;
		const outcome = await runFlagAnalytics({ store, logger: silentLogger(), nowMs: clock });
		expect(outcome.purged.flag_exposures.deleted).toBe(0);
		expect(outcome.purged.experiment_metric_events.deleted).toBe(0);
		expect(outcome.rolledUpDays).toBe(0);
	});
});

function silentLogger(): ConsumerLogger & { readonly lines: ConsumerLogEntry[] } {
	const lines: ConsumerLogEntry[] = [];
	const keep = (entry: ConsumerLogEntry): void => {
		lines.push(entry);
	};
	return { lines, info: keep, warn: keep, error: keep };
}

describe("FlagAnalyticsScheduler", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("first runs after the initial delay, then once per interval", async () => {
		const store = new RecordingStore();
		const scheduler = new FlagAnalyticsScheduler({ store, logger: silentLogger(), nowMs: clock });

		scheduler.start();
		await vi.advanceTimersByTimeAsync(RETENTION_INITIAL_DELAY_MS - 1);
		expect(store.days).toHaveLength(0);

		await vi.advanceTimersByTimeAsync(1);
		expect(store.days).toHaveLength(FLAG_ROLLUP_DAYS);

		await vi.advanceTimersByTimeAsync(RETENTION_INTERVAL_MS);
		expect(store.days).toHaveLength(FLAG_ROLLUP_DAYS * 2);

		await scheduler.stop();
	});

	it("logs a failed run and keeps the schedule alive (analytics never crash the consumer)", async () => {
		const store = new RecordingStore();
		store.failWith = new Error("connection lost");
		const logger = silentLogger();
		const scheduler = new FlagAnalyticsScheduler({ store, logger, nowMs: clock });

		scheduler.start();
		await vi.advanceTimersByTimeAsync(RETENTION_INITIAL_DELAY_MS);
		expect(logger.lines).toStrictEqual([{ event: "analytics.flag_analytics_failed", error: "connection lost" }]);

		store.failWith = undefined;
		await vi.advanceTimersByTimeAsync(RETENTION_INTERVAL_MS);
		expect(store.days).toHaveLength(FLAG_ROLLUP_DAYS);

		await scheduler.stop();
	});

	it("stops scheduling after stop()", async () => {
		const store = new RecordingStore();
		const scheduler = new FlagAnalyticsScheduler({ store, logger: silentLogger(), nowMs: clock });

		scheduler.start();
		await scheduler.stop();
		await vi.advanceTimersByTimeAsync(RETENTION_INITIAL_DELAY_MS + RETENTION_INTERVAL_MS * 2);

		expect(store.purged).toHaveLength(0);
	});
});

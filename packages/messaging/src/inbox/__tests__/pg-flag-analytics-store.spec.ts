import { describe, expect, it } from "vitest";

import type { FlagExposureRow, MetricEventRow } from "../flag-projections";
import { PgInboxStore, type SqlParameter, type SqlPool, type SqlPoolClient, type SqlResult, type SqlRow } from "../pg-inbox-store";

// The feature flag analytics SQL of `PgInboxStore` (ADR 087), against a recording pool: which statements run, in
// which transaction, under which lock, and how their rows are read. The SQL itself runs against Postgres in
// analytics-consumer's e2e suite.

const EXPERIMENT_ID = "019b76da-a800-7000-8000-0000000000e1";
const EVENT_ID = "0b8f5a52-6a3c-4c3e-9d8e-5d8b5f0f4a11";
const USER_ID = "5c1f7a9e-2b4d-4e8f-a1b2-c3d4e5f60718";
const NOW = 1_800_000_000_000;
const DAY = 1_799_971_200_000;
const GRACE_MS = 86_400_000;
const BATCH = 500;

interface Statement {
	readonly text: string;
	readonly values: readonly SqlParameter[];
}

function result(rows: readonly SqlRow[], rowCount: number | null = rows.length): SqlResult {
	return { rows, rowCount };
}

/** A pool that records every statement and answers by the first matching rule (else no rows). */
class RecordingPool implements SqlPool {
	public readonly statements: Statement[] = [];
	public readonly released: (Error | undefined)[] = [];
	public lockFree = true;
	public failOn: string | null = null;
	public failRollback = false;
	public answers: { readonly match: string; readonly result: SqlResult }[] = [];

	public query(text: string, values: SqlParameter[] = []): Promise<SqlResult> {
		this.statements.push({ text, values });
		if (text.includes("pg_try_advisory_xact_lock")) {
			return Promise.resolve(result([{ locked: this.lockFree }]));
		}
		if (this.failOn !== null && text.includes(this.failOn)) {
			return Promise.reject(new Error(`failed: ${this.failOn}`));
		}
		if (this.failRollback && text === "ROLLBACK") {
			return Promise.reject(new Error("connection reset"));
		}
		const answer = this.answers.find((candidate) => text.includes(candidate.match));
		return Promise.resolve(answer?.result ?? result([], 0));
	}

	public connect(): Promise<SqlPoolClient> {
		return Promise.resolve({
			query: (text: string, values?: SqlParameter[]): Promise<SqlResult> => this.query(text, values),
			release: (destroy?: Error): void => {
				this.released.push(destroy);
			},
		});
	}

	public texts(): readonly string[] {
		return this.statements.map((statement) => statement.text.trim().split(/\s+/u).slice(0, 3).join(" "));
	}
}

describe("PgInboxStore — feature flag analytics", () => {
	it("purges one bounded batch under the ledger's lock, and reports a held lock without deleting", async () => {
		const pool = new RecordingPool();
		pool.answers = [{ match: `DELETE FROM public."FeatureFlagExposure"`, result: result([], 7) }];
		const store = new PgInboxStore(pool);

		await expect(store.flagPurgeBatch("flag_exposures", NOW, BATCH)).resolves.toStrictEqual({ acquired: true, deleted: 7 });
		expect(pool.statements.find((statement) => statement.text.includes("DELETE"))?.values).toStrictEqual([NOW, BATCH]);
		expect(pool.texts().at(-1)).toBe("COMMIT");

		pool.lockFree = false;
		await expect(store.flagPurgeBatch("experiment_metric_events", NOW, BATCH)).resolves.toStrictEqual({ acquired: false });
	});

	it("rewrites a day's sums: the day's rows replaced by one per flag, rule and value", async () => {
		const pool = new RecordingPool();
		pool.answers = [
			{
				match: "COUNT(DISTINCT",
				result: result([
					{ kind: "FLAG", key: "web-activity", source: "RULE", ruleId: null, value: "on", exposures: 12, subjects: 9 },
					{ kind: "CONFIG", key: "reward-claim-cta", source: "EXPERIMENT", ruleId: null, value: "bold", exposures: 4, subjects: 4 },
				]),
			},
		];
		const store = new PgInboxStore(pool);

		await expect(store.rollupDay(DAY)).resolves.toBe(true);
		const inserts = pool.statements.filter((statement) => statement.text.includes(`INSERT INTO public."FeatureFlagExposureDaily"`));
		expect(inserts.map((statement) => statement.values.slice(1, 4))).toStrictEqual([
			["FLAG", "web-activity", DAY],
			["CONFIG", "reward-claim-cta", DAY],
		]);
		expect(pool.statements.some((statement) => statement.text.includes(`DELETE FROM public."FeatureFlagExposureDaily"`))).toBe(true);

		pool.lockFree = false;
		await expect(store.rollupDay(DAY)).resolves.toBe(false);
	});

	it("lists running and just-stopped experiments, a running one measured until now", async () => {
		const pool = new RecordingPool();
		pool.answers = [
			{
				match: `FROM public."Experiment"`,
				result: result([
					{ id: EXPERIMENT_ID, controlValueName: "standard", primaryMetric: "reward-claims", guardrailMetrics: ["sign-ins"], startedAt: "1700000000000", stoppedAt: null },
					{ id: EVENT_ID, controlValueName: "standard", primaryMetric: "sign-ins", guardrailMetrics: null, startedAt: 1_700_000_000_000, stoppedAt: NOW - 1 },
				]),
			},
		];
		const store = new PgInboxStore(pool);

		await expect(store.experimentsToCompute(NOW, GRACE_MS)).resolves.toStrictEqual([
			{ id: EXPERIMENT_ID, controlValueName: "standard", metrics: ["reward-claims", "sign-ins"], from: 1_700_000_000_000, until: NOW },
			{ id: EVENT_ID, controlValueName: "standard", metrics: ["sign-ins"], from: 1_700_000_000_000, until: NOW - 1 },
		]);
		expect(pool.statements.at(0)?.values).toStrictEqual([NOW - GRACE_MS]);
	});

	it("reads each variant's sums for one metric over the experiment's window", async () => {
		const pool = new RecordingPool();
		pool.answers = [{ match: "WITH assigned", result: result([{ valueName: "bold", subjects: 3, total: 5, totalSquares: 11 }]) }];
		const store = new PgInboxStore(pool);

		await expect(store.variantSums(EXPERIMENT_ID, "reward-claims", 1, 2)).resolves.toStrictEqual([{ valueName: "bold", subjects: 3, total: 5, totalSquares: 11 }]);
		expect(pool.statements.at(0)?.values).toStrictEqual([EXPERIMENT_ID, "reward-claims", 1, 2]);
	});

	it("upserts an experiment's results under its own lock", async () => {
		const pool = new RecordingPool();
		const store = new PgInboxStore(pool);
		const row = { metric: "reward-claims", valueName: "bold", subjects: 30, mean: 1.2, delta: 0.3, ciLow: 0.1, ciHigh: 0.5, significant: true };

		await expect(store.saveResults(EXPERIMENT_ID, [row], NOW)).resolves.toBe(true);
		const upsert = pool.statements.find((statement) => statement.text.includes(`INSERT INTO public."ExperimentResult"`));
		expect(upsert?.values.slice(1)).toStrictEqual([EXPERIMENT_ID, "reward-claims", "bold", 30, 1.2, 0.3, 0.1, 0.5, true, NOW]);
		expect(pool.statements.find((statement) => statement.text.includes("pg_try_advisory_xact_lock"))?.values).toStrictEqual([`analytics.experiment_results:${EXPERIMENT_ID}`]);

		pool.lockFree = false;
		await expect(store.saveResults(EXPERIMENT_ID, [row], NOW)).resolves.toBe(false);
	});

	it("writes exposures and metric occurrences in the inbox's own transaction, idempotently", async () => {
		const pool = new RecordingPool();
		const store = new PgInboxStore(pool);
		const exposure: FlagExposureRow = {
			eventId: EVENT_ID,
			position: 0,
			kind: "FLAG",
			key: "web-activity",
			app: "web",
			subjectUnit: "USER",
			subjectId: USER_ID,
			source: "RULE",
			revision: 2,
			ruleId: null,
			value: "on",
			experimentId: null,
			variant: null,
			occurredAt: NOW,
		};
		const metric: MetricEventRow = { eventId: EVENT_ID, metric: "sign-ins", userId: USER_ID, occurredAt: NOW };

		await store.inTransaction(async (tx): Promise<void> => {
			await tx.insertFlagExposures([exposure]);
			await tx.insertMetricEvents([metric]);
		});
		expect(pool.texts()).toStrictEqual(["BEGIN", `INSERT INTO public."FeatureFlagExposure"`, `INSERT INTO public."ExperimentMetricEvent"`, "COMMIT"]);
		expect(pool.statements.every((statement) => statement.text === "BEGIN" || statement.text === "COMMIT" || statement.text.includes("ON CONFLICT"))).toBe(true);
	});

	it("rolls back a failed transaction, and destroys a connection whose rollback failed", async () => {
		const pool = new RecordingPool();
		pool.failOn = `INSERT INTO public."ExperimentResult"`;
		const store = new PgInboxStore(pool);
		const row = { metric: "sign-ins", valueName: "bold", subjects: 1, mean: 1, delta: null, ciLow: null, ciHigh: null, significant: false };

		await expect(store.saveResults(EXPERIMENT_ID, [row], NOW)).rejects.toThrow("failed");
		expect(pool.texts().at(-1)).toBe("ROLLBACK");
		expect(pool.released).toStrictEqual([undefined]);

		pool.failRollback = true;
		await expect(store.saveResults(EXPERIMENT_ID, [row], NOW)).rejects.toThrow("failed");
		expect(pool.released.at(-1)).toBeInstanceOf(Error);
	});
});

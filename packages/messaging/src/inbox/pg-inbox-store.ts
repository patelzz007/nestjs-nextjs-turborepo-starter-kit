import { newRowId } from "@workspace/shared";

import pg from "pg";

import { z } from "zod";

import type { VariantSums } from "./experiment-statistics";
import { FLAG_ANALYTICS_LOCK_NAMES, type ExperimentResultRow, type FlagAnalyticsLedger, type FlagAnalyticsStore, type ResultExperiment } from "./flag-analytics";
import type { FlagExposureRow, MetricEventRow } from "./flag-projections";
import type { DbPoolSettings } from "./inbox-settings";
import type { AnalyticsEventRow, DeadLetterInput, InboxClaim, InboxStore, InboxTransaction } from "./inbox";
import { RETENTION_LOCK_NAMES, type LockedBatch, type RetentionLedger, type RetentionStore } from "./inbox-retention";

// ── The part of a pg pool the store uses ─────────────────────────────────────────────────────────
// A real `pg.Pool` is one; a test stands in a recording fake. Rows are read through zod schemas, never trusted.

/** A value a SQL statement is given. */
export type SqlParameter = string | number | boolean | bigint | null | Uint8Array | readonly string[];
/** One cell of a returned row (read through a schema before use). */
export type SqlCell = string | number | boolean | bigint | null | Date | Uint8Array | readonly SqlCell[] | { readonly [key: string]: SqlCell };
export type SqlRow = Readonly<Record<string, SqlCell>>;

export interface SqlResult {
	readonly rows: readonly SqlRow[];
	readonly rowCount: number | null;
}

export interface SqlClient {
	query(text: string, values?: SqlParameter[]): Promise<SqlResult>;
}

/** A pooled connection: released after its transaction, destroyed when it broke. */
export interface SqlPoolClient extends SqlClient {
	release(destroy?: Error): void;
}

export interface SqlPool extends SqlClient {
	connect(): Promise<SqlPoolClient>;
}

const LockRowSchema = z.object({ locked: z.boolean() });

/** Whether `pg_try_advisory_xact_lock` took the lock. */
function lockTaken(result: SqlResult): boolean {
	const [row] = z.array(LockRowSchema).parse(result.rows);
	return row?.locked === true;
}

/** `application_name` on every connection — shows in `pg_stat_activity` and the Postgres logs. */
export const CONSUMER_APPLICATION_NAME = "analytics-consumer";

/**
 * Who the consumer's writes are recorded as. The consumer has no RLS session (no user, API key or system
 * operation), so it names itself through `app.actor`: the database's row-audit trigger stamps `createdBy` /
 * `updatedBy` / `deletedBy` from it (apps/api/prisma/security/row-audit.ts).
 */
export const CONSUMER_ACTOR = "system:analytics-consumer";

/**
 * A value inside libpq's `options` startup string: whitespace separates `-c` switches there, so a
 * backslash and each whitespace character are escaped with a backslash (libpq's own escaping rule).
 */
export function escapeLibpqOptionValue(value: string): string {
	return value.replace(/[\\\s]/g, (character) => `\\${character}`);
}

/**
 * The consumer's Postgres pool: bounded size, bounded waits, and a
 * server-side `statement_timeout`, so a stuck query or an exhausted server
 * surfaces as an error (retried, then parked) instead of a hang.
 */
export function createConsumerPool(connectionString: string, settings: DbPoolSettings): pg.Pool {
	return new pg.Pool({
		connectionString,
		max: settings.max,
		connectionTimeoutMillis: settings.connectionTimeoutMs,
		idleTimeoutMillis: settings.idleTimeoutMs,
		statement_timeout: settings.statementTimeoutMs,
		application_name: CONSUMER_APPLICATION_NAME,
		options: `-c app.actor=${escapeLibpqOptionValue(CONSUMER_ACTOR)}`,
	});
}

class PgInboxTransaction implements InboxTransaction {
	public constructor(private readonly _client: SqlClient) {}

	public async claim(claim: InboxClaim): Promise<boolean> {
		const result = await this._client.query(
			`INSERT INTO public."InboxProcessedEvent" (consumer, "eventId", topic, "eventType")
			 VALUES ($1, $2::uuid, $3, $4)
			 ON CONFLICT (consumer, "eventId") DO NOTHING`,
			[claim.consumer, claim.eventId, claim.topic, claim.eventType],
		);
		return result.rowCount === 1;
	}

	public async insertAnalyticsEvent(row: AnalyticsEventRow): Promise<void> {
		// The analytics row id IS the stable event id: a second guard behind the inbox claim.
		await this._client.query(
			`INSERT INTO public."AnalyticsEvent" (id, topic, "eventType", "correlationId", "partitionKey", payload, "occurredAt")
			 VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
			 ON CONFLICT (id) DO NOTHING`,
			[row.eventId, row.topic, row.eventType, row.correlationId, row.partitionKey, JSON.stringify(row.payload), row.occurredAt],
		);
	}

	public async insertFlagExposures(rows: readonly FlagExposureRow[]): Promise<void> {
		for (const row of rows) {
			await this._client.query(
				`INSERT INTO public."FeatureFlagExposure"
				   (id, "eventId", position, kind, key, app, "subjectUnit", "subjectId", source, revision, "ruleId", value, "experimentId", variant, "occurredAt")
				 VALUES ($1, $2::uuid, $3, $4::"FlagEntryKind", $5, $6, $7::"FlagRolloutUnit", $8, $9::"FlagDecisionSource", $10, $11::uuid, $12, $13::uuid, $14, $15)
				 ON CONFLICT ("eventId", position) DO NOTHING`,
				[
					newRowId(),
					row.eventId,
					row.position,
					row.kind,
					row.key,
					row.app,
					row.subjectUnit,
					row.subjectId,
					row.source,
					row.revision,
					row.ruleId,
					row.value,
					row.experimentId,
					row.variant,
					row.occurredAt,
				],
			);
		}
	}

	public async insertMetricEvents(rows: readonly MetricEventRow[]): Promise<void> {
		for (const row of rows) {
			await this._client.query(
				`INSERT INTO public."ExperimentMetricEvent" (id, "eventId", metric, "userId", "occurredAt")
				 VALUES ($1, $2::uuid, $3, $4, $5)
				 ON CONFLICT ("eventId", metric) DO NOTHING`,
				[newRowId(), row.eventId, row.metric, row.userId, row.occurredAt],
			);
		}
	}
}

/** One bounded, oldest-first DELETE per ledger, scoped to one consumer's rows. */
const PURGE_SQL: Readonly<Record<RetentionLedger, string>> = {
	inbox_claims: `DELETE FROM public."InboxProcessedEvent"
		 WHERE (consumer, "eventId") IN (
		   SELECT consumer, "eventId" FROM public."InboxProcessedEvent"
		   WHERE consumer = $1 AND "processedAt" < $2
		   ORDER BY "processedAt"
		   LIMIT $3
		 )`,
	dead_letters: `DELETE FROM public."InboxDeadLetter"
		 WHERE id IN (
		   SELECT id FROM public."InboxDeadLetter"
		   WHERE consumer = $1 AND "receivedAt" < $2
		   ORDER BY "receivedAt"
		   LIMIT $3
		 )`,
};

const MS_PER_DAY = 86_400_000;

/** Takes a cluster-wide advisory lock for the transaction, without waiting. */
const TRY_LOCK_SQL = "SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS locked";

/** One bounded, oldest-first DELETE per flag analytics ledger (ADR 087). */
const FLAG_PURGE_SQL: Readonly<Record<FlagAnalyticsLedger, string>> = {
	flag_exposures: `DELETE FROM public."FeatureFlagExposure"
		 WHERE id IN (SELECT id FROM public."FeatureFlagExposure" WHERE "occurredAt" < $1 ORDER BY "occurredAt" LIMIT $2)`,
	experiment_metric_events: `DELETE FROM public."ExperimentMetricEvent"
		 WHERE id IN (SELECT id FROM public."ExperimentMetricEvent" WHERE "occurredAt" < $1 ORDER BY "occurredAt" LIMIT $2)`,
};

/**
 * Each subject an experiment exposed, in the variant it was first given, with how many times the metric happened
 * for it while the experiment ran; summed per variant (subjects, total, sum of squares) for the statistics.
 */
const VARIANT_SUMS_SQL = `
	WITH assigned AS (
		SELECT DISTINCT ON ("subjectId") "subjectId", variant
		FROM public."FeatureFlagExposure"
		WHERE "experimentId" = $1::uuid AND variant IS NOT NULL AND "isDeleted" = false
		ORDER BY "subjectId", "occurredAt"
	), counted AS (
		SELECT assigned."subjectId", assigned.variant, COUNT(metric.id)::bigint AS occurrences
		FROM assigned
		LEFT JOIN public."ExperimentMetricEvent" metric
		  ON metric."userId" = assigned."subjectId" AND metric.metric = $2 AND metric."occurredAt" >= $3 AND metric."occurredAt" < $4 AND metric."isDeleted" = false
		GROUP BY assigned."subjectId", assigned.variant
	)
	SELECT variant AS "valueName", COUNT(*)::int AS subjects, COALESCE(SUM(occurrences), 0)::float8 AS total, COALESCE(SUM(occurrences * occurrences), 0)::float8 AS "totalSquares"
	FROM counted
	GROUP BY variant`;

const DailySumRowSchema = z.object({
	kind: z.string(),
	key: z.string(),
	source: z.string(),
	ruleId: z.string().nullable(),
	value: z.string(),
	exposures: z.number().int(),
	subjects: z.number().int(),
});

const ExperimentRowSchema = z.object({
	id: z.string(),
	controlValueName: z.string(),
	primaryMetric: z.string(),
	guardrailMetrics: z
		.array(z.string())
		.nullable()
		.transform((metrics) => metrics ?? []),
	startedAt: z.coerce.number(),
	stoppedAt: z.coerce.number().nullable(),
});

const VariantSumsRowSchema = z.object({ valueName: z.string(), subjects: z.number().int(), total: z.number(), totalSquares: z.number() });

/**
 * Postgres inbox. Connects as the least-privilege `analytics_consumer` login
 * (apps/api/prisma/security/roles.ts): INSERT/SELECT/DELETE on its three
 * tables only, and RLS policies that apply to that role alone — it never
 * switches role and never sets `app.rls_bypass`.
 */
export class PgInboxStore implements InboxStore, RetentionStore, FlagAnalyticsStore {
	public constructor(private readonly _pool: SqlPool) {}

	public inTransaction<T>(work: (tx: InboxTransaction) => Promise<T>): Promise<T> {
		return this.withTransaction((client): Promise<T> => work(new PgInboxTransaction(client)));
	}

	public async park(deadLetter: DeadLetterInput): Promise<void> {
		const payload = deadLetter.payload;
		await this._pool.query(
			`INSERT INTO public."InboxDeadLetter"
			   (id, consumer, topic, partition, "offset", "eventId", reason, error, attempts,
			    "rawValue", "rawValueSizeBytes", "rawValueSha256", "rawValueTruncated")
			 VALUES ($1, $2, $3, $4, $5, $6::uuid, $7::"InboxDeadLetterReason", $8, $9, $10, $11, $12, $13)
			 ON CONFLICT (consumer, topic, partition, "offset") DO NOTHING`,
			[
				newRowId(),
				deadLetter.consumer,
				deadLetter.topic,
				deadLetter.partition,
				deadLetter.offset,
				deadLetter.eventId,
				deadLetter.reason,
				deadLetter.error,
				deadLetter.attempts,
				payload?.bytes ?? null,
				payload?.sizeBytes ?? null,
				payload?.sha256 ?? null,
				payload?.truncated ?? false,
			],
		);
	}

	/**
	 * `pg_try_advisory_xact_lock` never waits: a second instance gets
	 * `{ acquired: false }` immediately. Being transaction-scoped, the lock is
	 * released by COMMIT/ROLLBACK on the same server connection — correct
	 * behind PgBouncer in transaction mode, and a crashed holder can never
	 * leave it held.
	 */
	public purgeBatch(ledger: RetentionLedger, consumer: string, cutoffEpochMs: number, batchSize: number): Promise<LockedBatch> {
		return this.withTransaction(async (client): Promise<LockedBatch> => {
			if (!lockTaken(await client.query(TRY_LOCK_SQL, [RETENTION_LOCK_NAMES[ledger]]))) {
				return { acquired: false };
			}
			const result = await client.query(PURGE_SQL[ledger], [consumer, cutoffEpochMs, batchSize]);
			return { acquired: true, deleted: result.rowCount ?? 0 };
		});
	}

	// ── Feature flag analytics (ADR 087): `FlagAnalyticsStore` ──

	public flagPurgeBatch(ledger: FlagAnalyticsLedger, cutoffEpochMs: number, batchSize: number): Promise<LockedBatch> {
		return this.withLock(
			FLAG_ANALYTICS_LOCK_NAMES[ledger],
			async (client): Promise<number> => (await client.query(FLAG_PURGE_SQL[ledger], [cutoffEpochMs, batchSize])).rowCount ?? 0,
		).then((outcome): LockedBatch => (outcome.acquired ? { acquired: true, deleted: outcome.value } : { acquired: false }));
	}

	public async rollupDay(dayStart: number): Promise<boolean> {
		const outcome = await this.withLock(FLAG_ANALYTICS_LOCK_NAMES.rollup, async (client): Promise<number> => {
			const sums = z.array(DailySumRowSchema).parse(
				(
					await client.query(
						`SELECT kind::text AS kind, key, source::text AS source, "ruleId"::text AS "ruleId", value,
						        COUNT(*)::int AS exposures, COUNT(DISTINCT "subjectId")::int AS subjects
						 FROM public."FeatureFlagExposure"
						 WHERE "occurredAt" >= $1 AND "occurredAt" < $2 AND "isDeleted" = false
						 GROUP BY kind, key, source, "ruleId", value`,
						[dayStart, dayStart + MS_PER_DAY],
					)
				).rows,
			);
			await client.query(`DELETE FROM public."FeatureFlagExposureDaily" WHERE day = $1`, [dayStart]);
			for (const sum of sums) {
				await client.query(
					`INSERT INTO public."FeatureFlagExposureDaily" (id, kind, key, day, source, "ruleId", value, exposures, subjects)
					 VALUES ($1, $2::"FlagEntryKind", $3, $4, $5::"FlagDecisionSource", $6::uuid, $7, $8, $9)`,
					[newRowId(), sum.kind, sum.key, dayStart, sum.source, sum.ruleId, sum.value, sum.exposures, sum.subjects],
				);
			}
			return sums.length;
		});
		return outcome.acquired;
	}

	public async experimentsToCompute(now: number, stoppedGraceMs: number): Promise<readonly ResultExperiment[]> {
		const result = await this._pool.query(
			`SELECT id, "controlValueName", "primaryMetric", "guardrailMetrics", "startedAt", "stoppedAt"
			 FROM public."Experiment"
			 WHERE "isDeleted" = false AND "startedAt" IS NOT NULL
			   AND (status = 'RUNNING' OR (status = 'STOPPED' AND "stoppedAt" >= $1))`,
			[now - stoppedGraceMs],
		);
		return z
			.array(ExperimentRowSchema)
			.parse(result.rows)
			.map((row) => ({
				id: row.id,
				controlValueName: row.controlValueName,
				metrics: [row.primaryMetric, ...row.guardrailMetrics],
				from: row.startedAt,
				until: row.stoppedAt ?? now,
			}));
	}

	public async variantSums(experimentId: string, metric: string, from: number, until: number): Promise<readonly VariantSums[]> {
		const result = await this._pool.query(VARIANT_SUMS_SQL, [experimentId, metric, from, until]);
		return z.array(VariantSumsRowSchema).parse(result.rows);
	}

	public async saveResults(experimentId: string, rows: readonly ExperimentResultRow[], computedAt: number): Promise<boolean> {
		const outcome = await this.withLock(`${FLAG_ANALYTICS_LOCK_NAMES.results}:${experimentId}`, async (client): Promise<number> => {
			for (const row of rows) {
				await client.query(
					`INSERT INTO public."ExperimentResult" (id, "experimentId", metric, "valueName", subjects, mean, delta, "ciLow", "ciHigh", significant, "computedAt")
					 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
					 ON CONFLICT ("experimentId", metric, "valueName") DO UPDATE SET
					   subjects = EXCLUDED.subjects, mean = EXCLUDED.mean, delta = EXCLUDED.delta, "ciLow" = EXCLUDED."ciLow",
					   "ciHigh" = EXCLUDED."ciHigh", significant = EXCLUDED.significant, "computedAt" = EXCLUDED."computedAt"`,
					[newRowId(), experimentId, row.metric, row.valueName, row.subjects, row.mean, row.delta, row.ciLow, row.ciHigh, row.significant, computedAt],
				);
			}
			return rows.length;
		});
		return outcome.acquired;
	}

	/** `work` in one transaction under a cluster-wide advisory lock taken without waiting; not run when it is held. */
	private withLock<T>(name: string, work: (client: SqlClient) => Promise<T>): Promise<{ readonly acquired: true; readonly value: T } | { readonly acquired: false }> {
		return this.withTransaction(async (client) => {
			if (!lockTaken(await client.query(TRY_LOCK_SQL, [name]))) {
				return { acquired: false };
			}
			return { acquired: true, value: await work(client) };
		});
	}

	/** BEGIN → work → COMMIT (ROLLBACK on any error). A connection whose ROLLBACK fails is destroyed rather than pooled. */
	private async withTransaction<T>(work: (client: SqlClient) => Promise<T>): Promise<T> {
		const client = await this._pool.connect();
		let brokenConnection: Error | undefined;
		try {
			await client.query("BEGIN");
			const result = await work(client);
			await client.query("COMMIT");
			return result;
		} catch (error) {
			try {
				await client.query("ROLLBACK");
			} catch (rollbackError) {
				brokenConnection = rollbackError instanceof Error ? rollbackError : new Error(String(rollbackError));
			}
			throw error;
		} finally {
			client.release(brokenConnection);
		}
	}
}

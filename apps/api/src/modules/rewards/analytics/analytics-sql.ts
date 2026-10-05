import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { AnalyticsInterval } from "@workspace/shared";
import { z } from "zod";

import { DependencyUnavailableError } from "../../../common/errors/app-error";
import { PrismaService } from "../../../prisma/prisma.service";
import type { AnalyticsWindow } from "./analytics-scope";

/**
 * Time budget of ONE analytics statement. A dashboard or export runs a handful
 * of aggregates over at most 366 days, each served by a `(scope, timestamp)`
 * index; one that still runs this long is cancelled by Postgres rather than
 * holding a pooled connection (and the request) open indefinitely.
 */
export const ANALYTICS_STATEMENT_TIMEOUT_MS = 10_000;

/** Postgres SQLSTATE `query_canceled` — raised when `statement_timeout` fires. */
const POSTGRES_QUERY_CANCELED = "57014";

/** Prisma: a raw query failed (the driver adapter's error is in `meta`). */
const PRISMA_RAW_QUERY_FAILED = "P2010";

const RawQueryFailureMetaSchema = z.object({ driverAdapterError: z.object({ cause: z.object({ code: z.string() }) }) });

/** Postgres `interval` step of one bucket, bound as a parameter and cast — never interpolated. */
const BUCKET_STEP: Readonly<Record<AnalyticsInterval, string>> = {
	day: "1 day",
	week: "1 week",
	month: "1 month",
};

/** An aggregate without GROUP BY always yields one row; none means the statement itself is wrong. */
export class AnalyticsAggregateRowMissingError extends Error {
	public constructor() {
		super("An analytics aggregate returned no row");
		this.name = "AnalyticsAggregateRowMissingError";
	}
}

/** A report statement ran past {@link ANALYTICS_STATEMENT_TIMEOUT_MS}: 503, the caller may retry with a shorter range. */
export class AnalyticsQueryTimeoutError extends DependencyUnavailableError {
	public constructor(cause: Error) {
		super({
			code: "ANALYTICS_QUERY_TIMEOUT",
			message: "The report took too long to compute. Choose a shorter date range or a coarser interval and try again.",
			cause,
		});
	}
}

/** Whether `error` is Postgres cancelling a statement for exceeding `statement_timeout`. */
export function isStatementTimeout(error: Error): boolean {
	if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== PRISMA_RAW_QUERY_FAILED) {
		return false;
	}
	const meta = RawQueryFailureMetaSchema.safeParse(error.meta);
	return meta.success && meta.data.driverAdapterError.cause.code === POSTGRES_QUERY_CANCELED;
}

/**
 * `date_trunc(interval, <epoch-ms column> as local time in the window's zone)` —
 * the LOCAL start of the bucket a timestamp falls in (a `timestamp without
 * time zone`). Weeks start on Monday (Postgres' ISO week), months on the 1st.
 */
export function localBucketOf(epochMsColumn: Prisma.Sql, window: AnalyticsWindow): Prisma.Sql {
	return Prisma.sql`date_trunc(${window.interval}, to_timestamp(${epochMsColumn} / 1000.0) AT TIME ZONE ${window.timeZone})`;
}

/**
 * CTE `buckets(local_start, start_ms, end_ms, is_partial)`: EVERY bucket of the
 * window, generated in Postgres. Buckets step through LOCAL wall-clock time, so
 * a day is 23 or 25 hours across a DST change and a month is its real length;
 * `start_ms` / `end_ms` are clipped to the window and `is_partial` marks a
 * clipped bucket. Join facts on `local_start` (see {@link localBucketOf}).
 */
export function bucketsCte(window: AnalyticsWindow): Prisma.Sql {
	const step = BUCKET_STEP[window.interval];
	const localStartMs = Prisma.sql`(EXTRACT(EPOCH FROM (g.local_start AT TIME ZONE ${window.timeZone})) * 1000)::bigint`;
	const localEndMs = Prisma.sql`(EXTRACT(EPOCH FROM ((g.local_start + ${step}::interval) AT TIME ZONE ${window.timeZone})) * 1000)::bigint`;
	return Prisma.sql`buckets AS (
		SELECT g.local_start,
		       GREATEST(${localStartMs}, ${window.fromMs}::bigint) AS start_ms,
		       LEAST(${localEndMs}, ${window.toMs}::bigint) AS end_ms,
		       (${localStartMs} < ${window.fromMs}::bigint OR ${localEndMs} > ${window.toMs}::bigint) AS is_partial
		FROM generate_series(
			${localBucketOf(Prisma.sql`${window.fromMs}::bigint`, window)},
			${localBucketOf(Prisma.sql`(${window.toMs}::bigint - 1)`, window)},
			${step}::interval
		) AS g(local_start)
	)`;
}

/** `sum / count` rounded to whole minor units, 0 when there is nothing to average — computed in SQL. */
export function averageSql(sum: Prisma.Sql, count: Prisma.Sql): Prisma.Sql {
	return Prisma.sql`CASE WHEN ${count} = 0 THEN 0 ELSE ROUND(${sum}::numeric / ${count}) END::bigint`;
}

/**
 * Runs one analytics statement inside a short transaction that first sets
 * `statement_timeout` to {@link ANALYTICS_STATEMENT_TIMEOUT_MS} (`SET LOCAL`:
 * it ends with the transaction, the pooled connection is untouched), then
 * parses the rows with `schema`. A timeout becomes {@link AnalyticsQueryTimeoutError}.
 * The caller's RLS scope applies as for any other query (the pool stamps it on checkout).
 */
@Injectable()
export class AnalyticsSqlRunner {
	public constructor(private readonly prisma: PrismaService) {}

	public async rows<TRow>(schema: z.ZodType<TRow>, sql: Prisma.Sql): Promise<TRow[]> {
		try {
			const [, rows] = await this.prisma.$transaction([
				this.prisma.$queryRaw`SELECT set_config('statement_timeout', ${String(ANALYTICS_STATEMENT_TIMEOUT_MS)}, true)`,
				this.prisma.$queryRaw(sql),
			]);
			return schema.array().parse(rows);
		} catch (error) {
			if (error instanceof Error && isStatementTimeout(error)) {
				throw new AnalyticsQueryTimeoutError(error);
			}
			throw error;
		}
	}

	/** {@link rows} for a statement that returns exactly one row (an aggregate without GROUP BY). */
	public async row<TRow>(schema: z.ZodType<TRow>, sql: Prisma.Sql): Promise<TRow> {
		const [row] = await this.rows(schema, sql);
		if (row === undefined) {
			throw new AnalyticsAggregateRowMissingError();
		}
		return row;
	}
}

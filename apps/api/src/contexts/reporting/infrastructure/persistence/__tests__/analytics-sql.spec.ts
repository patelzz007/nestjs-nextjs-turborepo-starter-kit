import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import type { AnalyticsWindow } from "../../../domain/value-objects/analytics-scope.value-object";
import { analyticsConcurrencyLimit, AnalyticsQueryTimeoutError, averageSql, bucketsCte, isStatementTimeout, localBucketOf } from "../analytics-sql";

const WINDOW: AnalyticsWindow = { fromMs: 1_000, toMs: 2_000, timeZone: "Europe/London", interval: "month" };

function rawQueryFailure(code: string): Prisma.PrismaClientKnownRequestError {
	return new Prisma.PrismaClientKnownRequestError("Raw query failed", {
		code: "P2010",
		clientVersion: "test",
		meta: { driverAdapterError: { name: "DriverAdapterError", cause: { code, kind: "postgres" } } },
	});
}

describe("isStatementTimeout", () => {
	it("recognises Postgres cancelling a statement for statement_timeout (57014), and nothing else", () => {
		expect(isStatementTimeout(rawQueryFailure("57014"))).toBe(true);
		expect(isStatementTimeout(rawQueryFailure("23505"))).toBe(false);
		expect(isStatementTimeout(new Error("canceling statement due to statement timeout"))).toBe(false);
	});

	it("maps to a 503 the client can act on", () => {
		const error = new AnalyticsQueryTimeoutError(rawQueryFailure("57014"));
		expect(error).toMatchObject({ code: "ANALYTICS_QUERY_TIMEOUT", httpStatus: 503 });
	});
});

describe("bucket SQL", () => {
	it("binds the interval, zone and range as parameters — never as SQL text", () => {
		const cte = bucketsCte(WINDOW);
		expect(cte.text).not.toContain("Europe/London");
		expect(cte.text).not.toContain("month");
		expect(cte.values).toEqual(expect.arrayContaining(["Europe/London", "month", "1 month", 1_000, 2_000]));
		expect(localBucketOf(Prisma.sql`s."paidAt"`, WINDOW).text).toBe('date_trunc($1, to_timestamp(s."paidAt" / 1000.0) AT TIME ZONE $2)');
	});

	it("averages in SQL with a zero guard", () => {
		expect(averageSql(Prisma.sql`x`, Prisma.sql`n`).text).toBe("CASE WHEN n = 0 THEN 0 ELSE ROUND(x::numeric / n) END::bigint");
	});
});

describe("analyticsConcurrencyLimit", () => {
	it("keeps half the request pool for everything that is not analytics, and at least one slot", () => {
		expect(analyticsConcurrencyLimit(8)).toBe(4);
		expect(analyticsConcurrencyLimit(9)).toBe(4);
		expect(analyticsConcurrencyLimit(1)).toBe(1);
	});
});

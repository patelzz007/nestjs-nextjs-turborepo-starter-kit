import { type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import type { AnalyticsWindow } from "../src/modules/rewards/analytics/analytics-scope";
import { AnalyticsSqlRunner, bucketsCte } from "../src/modules/rewards/analytics/analytics-sql";
import { createE2eApp } from "./e2e-helpers";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

const BucketRowSchema = z.object({ start_ms: z.bigint(), end_ms: z.bigint(), is_partial: z.boolean() });

/**
 * The bucket generator runs in Postgres (time-zone database included), so it
 * is checked against Postgres: local-midnight days across DST changes,
 * Monday weeks, calendar months incl. a leap February, clipped edges.
 */
describe("Analytics buckets in Postgres (e2e)", () => {
	let app: NestFastifyApplication;
	let sql: AnalyticsSqlRunner;

	async function buckets(window: AnalyticsWindow): Promise<[number, number, boolean][]> {
		const rows = await sql.rows(BucketRowSchema, Prisma.sql`WITH ${bucketsCte(window)} SELECT start_ms, end_ms, is_partial FROM buckets ORDER BY local_start`);
		return rows.map((row) => [Number(row.start_ms), Number(row.end_ms), row.is_partial]);
	}

	beforeAll(async () => {
		app = await createE2eApp();
		sql = app.get(AnalyticsSqlRunner);
	});

	afterAll(async () => {
		await app.close();
	});

	it("cuts days at LOCAL midnight: the day London leaves summer time is 25 hours long", async () => {
		// Europe/London: 2026-10-24 00:00 BST = 23:00 UTC the day before; 2026-10-27 00:00 GMT = 00:00 UTC.
		const from = Date.UTC(2026, 9, 23, 23);
		const to = Date.UTC(2026, 9, 27);
		const result = await buckets({ fromMs: from, toMs: to, timeZone: "Europe/London", interval: "day" });

		expect(result).toEqual([
			[from, Date.UTC(2026, 9, 24, 23), false],
			[Date.UTC(2026, 9, 24, 23), Date.UTC(2026, 9, 26), false],
			[Date.UTC(2026, 9, 26), to, false],
		]);
		expect(result.map(([start, end]) => (end - start) / HOUR_MS)).toEqual([24, 25, 24]);
	});

	it("makes the spring-forward day 23 hours long", async () => {
		// Europe/London enters summer time on 2026-03-29.
		const result = await buckets({ fromMs: Date.UTC(2026, 2, 29), toMs: Date.UTC(2026, 2, 29, 23), timeZone: "Europe/London", interval: "day" });

		expect(result).toEqual([[Date.UTC(2026, 2, 29), Date.UTC(2026, 2, 29, 23), false]]);
	});

	it("starts weeks on Monday 00:00 local and clips the first one to the range (a 169-hour DST week in New York)", async () => {
		// America/New_York leaves DST on Sunday 2026-11-01; Wed 2026-10-28 00:00 EDT = 04:00 UTC.
		const from = Date.UTC(2026, 9, 28, 4);
		const to = Date.UTC(2026, 10, 9, 5);
		const result = await buckets({ fromMs: from, toMs: to, timeZone: "America/New_York", interval: "week" });

		expect(result).toEqual([
			[from, Date.UTC(2026, 10, 2, 5), true],
			[Date.UTC(2026, 10, 2, 5), to, false],
		]);
		expect((Date.UTC(2026, 10, 2, 5) - Date.UTC(2026, 9, 26, 4)) / HOUR_MS).toBe(169);
	});

	it("cuts months on the 1st (a leap February has 29 days) and marks the clipped first and last month partial", async () => {
		const from = Date.UTC(2028, 0, 15);
		const to = Date.UTC(2028, 3, 10);
		const result = await buckets({ fromMs: from, toMs: to, timeZone: "UTC", interval: "month" });

		expect(result).toEqual([
			[from, Date.UTC(2028, 1, 1), true],
			[Date.UTC(2028, 1, 1), Date.UTC(2028, 2, 1), false],
			[Date.UTC(2028, 2, 1), Date.UTC(2028, 3, 1), false],
			[Date.UTC(2028, 3, 1), to, true],
		]);
		expect((Date.UTC(2028, 2, 1) - Date.UTC(2028, 1, 1)) / DAY_MS).toBe(29);
	});

	it("never adds an empty bucket after a range that ends exactly on a boundary (`to` is exclusive)", async () => {
		// Kuala Lumpur (UTC+8): September 2026 is [Aug 31 16:00 UTC, Sep 30 16:00 UTC).
		const result = await buckets({ fromMs: Date.UTC(2026, 7, 31, 16), toMs: Date.UTC(2026, 8, 30, 16), timeZone: "Asia/Kuala_Lumpur", interval: "month" });

		expect(result).toEqual([[Date.UTC(2026, 7, 31, 16), Date.UTC(2026, 8, 30, 16), false]]);
	});

	it("returns 367 daily buckets for the longest range (a leap year plus a partial day)", async () => {
		const from = Date.UTC(2027, 11, 31, 12);
		const result = await buckets({ fromMs: from, toMs: from + 366 * DAY_MS, timeZone: "UTC", interval: "day" });

		expect(result).toHaveLength(367);
		expect(result.at(0)?.[2]).toBe(true);
		expect(result.at(-1)?.[2]).toBe(true);
	});
});

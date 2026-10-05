import { MAX_ANALYTICS_RANGE_DAYS, type LocalDate } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import {
	analyticsPrefetchKey,
	ANALYTICS_URL_STATE,
	checkCustomRange,
	CUSTOM_RANGE_ISSUE_MESSAGES,
	presetLocalDateRange,
	resolveAnalyticsRange,
	toAnalyticsRangeQuery,
	type AnalyticsUrlState,
	type LocalDateRange,
	type RelativeAnalyticsRangePreset,
} from "./analytics-range";

const KUALA_LUMPUR = "Asia/Kuala_Lumpur";
const UTC = "UTC";
const DEFAULT_STATE: AnalyticsUrlState = ANALYTICS_URL_STATE.defaults;

function range(fromDate: LocalDate, toDate: LocalDate): LocalDateRange {
	return { fromDate, toDate };
}

describe("presetLocalDateRange", () => {
	const CASES: readonly [RelativeAnalyticsRangePreset, LocalDate, LocalDateRange][] = [
		["last7Days", "2026-10-05", range("2026-09-29", "2026-10-05")],
		["last30Days", "2026-10-05", range("2026-09-06", "2026-10-05")],
		["last90Days", "2026-10-05", range("2026-07-08", "2026-10-05")],
		["thisMonth", "2026-10-05", range("2026-10-01", "2026-10-05")],
		["thisMonth", "2026-10-01", range("2026-10-01", "2026-10-01")],
		["lastMonth", "2026-10-05", range("2026-09-01", "2026-09-30")],
		// January's "last month" is December of the year before.
		["lastMonth", "2027-01-15", range("2026-12-01", "2026-12-31")],
		// A leap February.
		["lastMonth", "2028-03-31", range("2028-02-01", "2028-02-29")],
		["thisQuarter", "2026-10-05", range("2026-10-01", "2026-10-05")],
		["thisQuarter", "2026-09-30", range("2026-07-01", "2026-09-30")],
		["thisQuarter", "2026-02-14", range("2026-01-01", "2026-02-14")],
		["yearToDate", "2026-10-05", range("2026-01-01", "2026-10-05")],
		["last12Months", "2026-10-05", range("2025-11-01", "2026-10-05")],
		["last12Months", "2026-01-31", range("2025-02-01", "2026-01-31")],
	];

	it.each(CASES)("%s on %s covers the expected days", (preset: RelativeAnalyticsRangePreset, today: LocalDate, expected: LocalDateRange): void => {
		expect(presetLocalDateRange(preset, today)).toEqual(expected);
	});

	it("never exceeds the API's maximum, even year to date on 31 December of a leap year", (): void => {
		const { fromDate, toDate } = presetLocalDateRange("yearToDate", "2028-12-31");
		expect(checkCustomRange(fromDate, toDate).ok).toBe(true);
		const months = presetLocalDateRange("last12Months", "2028-12-31");
		expect(checkCustomRange(months.fromDate, months.toDate).ok).toBe(true);
	});
});

describe("checkCustomRange", () => {
	it("accepts an in-order range of up to the maximum, both ends included", (): void => {
		expect(checkCustomRange("2026-09-01", "2026-09-30")).toEqual({ ok: true, range: range("2026-09-01", "2026-09-30") });
		expect(checkCustomRange("2026-10-05", "2026-10-05").ok).toBe(true);
		expect(checkCustomRange("2028-01-01", "2028-12-31").ok).toBe(true);
	});

	it("rejects a missing or malformed end", (): void => {
		expect(checkCustomRange("2026-09-01", undefined)).toEqual({ ok: false, issue: "incomplete" });
		expect(checkCustomRange("", "2026-09-30")).toEqual({ ok: false, issue: "incomplete" });
		expect(checkCustomRange("2026-02-30", "2026-03-01")).toEqual({ ok: false, issue: "incomplete" });
	});

	it("rejects an end before the start", (): void => {
		expect(checkCustomRange("2026-09-30", "2026-09-01")).toEqual({ ok: false, issue: "reversed" });
	});

	it(`rejects more than ${String(MAX_ANALYTICS_RANGE_DAYS)} days with the API's own message`, (): void => {
		expect(checkCustomRange("2026-01-01", "2027-01-02")).toEqual({ ok: false, issue: "tooLong" });
		expect(CUSTOM_RANGE_ISSUE_MESSAGES.tooLong).toContain(String(MAX_ANALYTICS_RANGE_DAYS));
	});
});

describe("resolveAnalyticsRange", () => {
	/** 5 Oct 2026 20:00 UTC — already 6 Oct 04:00 in Kuala Lumpur. */
	const NOW = Date.UTC(2026, 9, 5, 20);

	it("defaults to the last 30 whole days, ending today in the report's zone", (): void => {
		const resolved = resolveAnalyticsRange(DEFAULT_STATE, NOW, UTC);

		expect(resolved.preset).toBe("last30Days");
		expect(resolved.days).toEqual(range("2026-09-06", "2026-10-05"));
		expect(resolved.fromMs).toBe(Date.UTC(2026, 8, 6));
		expect(resolved.toMs).toBe(Date.UTC(2026, 9, 6));
		expect(resolved.interval).toBe("day");
		expect(resolved.today).toBe("2026-10-05");
	});

	it("cuts days at the merchant's local midnight", (): void => {
		const resolved = resolveAnalyticsRange({ ...DEFAULT_STATE, range: "thisMonth" }, NOW, KUALA_LUMPUR);

		// It is already 6 Oct in Kuala Lumpur; its October starts 30 Sep 16:00 UTC.
		expect(resolved.days).toEqual(range("2026-10-01", "2026-10-06"));
		expect(resolved.fromMs).toBe(Date.UTC(2026, 8, 30, 16));
		expect(resolved.toMs).toBe(Date.UTC(2026, 9, 6, 16));
	});

	it("uses a valid custom range and derives the interval from its length", (): void => {
		const resolved = resolveAnalyticsRange({ ...DEFAULT_STATE, range: "custom", from: "2026-01-01", to: "2026-06-30" }, NOW, UTC);

		expect(resolved.preset).toBe("custom");
		expect(resolved.fromMs).toBe(Date.UTC(2026, 0, 1));
		expect(resolved.toMs).toBe(Date.UTC(2026, 6, 1));
		expect(resolved.interval).toBe("week");
	});

	it("falls back to the default preset when the URL's custom range is invalid", (): void => {
		const resolved = resolveAnalyticsRange({ ...DEFAULT_STATE, range: "custom", from: "2025-01-01", to: "2026-10-01" }, NOW, UTC);

		expect(resolved.preset).toBe("last30Days");
		expect(resolved.days).toEqual(range("2026-09-06", "2026-10-05"));
	});

	it("keeps an interval chosen in the URL", (): void => {
		expect(resolveAnalyticsRange({ ...DEFAULT_STATE, range: "last12Months", interval: "week" }, NOW, UTC).interval).toBe("week");
		expect(resolveAnalyticsRange({ ...DEFAULT_STATE, range: "last12Months" }, NOW, UTC).interval).toBe("month");
	});

	it("gives the query fields of the range", (): void => {
		expect(toAnalyticsRangeQuery(resolveAnalyticsRange(DEFAULT_STATE, NOW, UTC))).toEqual({ from: Date.UTC(2026, 8, 6), to: Date.UTC(2026, 9, 6), interval: "day" });
	});
});

describe("ANALYTICS_URL_STATE", () => {
	it("parses a shared link and ignores invalid params one by one", (): void => {
		const parsed = ANALYTICS_URL_STATE.parse(new URLSearchParams("range=custom&from=2026-09-01&to=not-a-date&interval=hour"));

		expect(parsed).toEqual({ range: "custom", from: "2026-09-01", to: undefined, interval: undefined });
	});

	it("leaves the default preset out of the URL and round-trips the rest", (): void => {
		expect(ANALYTICS_URL_STATE.serialize(DEFAULT_STATE)).toBe("");
		const state: AnalyticsUrlState = { range: "custom", from: "2026-09-01", to: "2026-09-30", interval: "week" };
		const query = ANALYTICS_URL_STATE.serialize(state);
		expect(query).toBe("range=custom&from=2026-09-01&to=2026-09-30&interval=week");
		expect(ANALYTICS_URL_STATE.parse(new URLSearchParams(query))).toEqual(state);
	});
});

describe("analyticsPrefetchKey", () => {
	it("differs for every input that changes the answer", (): void => {
		const query = { from: 1, to: 2, interval: "day" } satisfies Parameters<typeof analyticsPrefetchKey>[0];

		expect(analyticsPrefetchKey(query)).toBe("1|2|day|");
		expect(analyticsPrefetchKey(query, "store-1")).toBe("1|2|day|store-1");
		expect(analyticsPrefetchKey({ ...query, interval: "week" })).not.toBe(analyticsPrefetchKey(query));
	});
});

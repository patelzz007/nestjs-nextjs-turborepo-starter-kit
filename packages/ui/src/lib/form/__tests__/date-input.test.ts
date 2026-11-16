import { afterEach, describe, expect, it, vi } from "vitest";

import { utcEpochMs } from "@workspace/shared";

import { DateInputEpochMsSchema, dateInputStringToEpochMs, epochMsToDateInputString, formatDateInputString, parseDateInputString } from "@workspace/ui/lib/form/date-input";

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("dateInputStringToEpochMs", () => {
	it("stores a picked day as the epoch milliseconds of its UTC midnight", () => {
		expect(dateInputStringToEpochMs("2026-10-01")).toBe(utcEpochMs(2026, 10, 1));
	});

	it.each(["America/Los_Angeles", "Asia/Kuala_Lumpur", "Pacific/Kiritimati"])("is the same whatever the runtime's zone is (%s)", (zone) => {
		vi.stubEnv("TZ", zone);
		expect(dateInputStringToEpochMs("2026-10-01")).toBe(utcEpochMs(2026, 10, 1));
	});

	it("rejects a malformed or impossible day", () => {
		expect(dateInputStringToEpochMs("01/10/2026")).toBeUndefined();
		expect(dateInputStringToEpochMs("2026-02-30")).toBeUndefined();
	});
});

describe("epochMsToDateInputString", () => {
	it("is the UTC calendar day of the instant", () => {
		expect(epochMsToDateInputString(utcEpochMs(2026, 10, 1))).toBe("2026-10-01");
		expect(epochMsToDateInputString(utcEpochMs(2026, 10, 1, 23, 59))).toBe("2026-10-01");
	});

	it("round-trips with dateInputStringToEpochMs", () => {
		expect(epochMsToDateInputString(dateInputStringToEpochMs("2024-02-29") ?? 0)).toBe("2024-02-29");
	});
});

describe("DateInputEpochMsSchema", () => {
	it("submits a picked day as epoch milliseconds", () => {
		expect(DateInputEpochMsSchema.parse("2026-10-01")).toBe(utcEpochMs(2026, 10, 1));
	});

	it("rejects a day that does not exist", () => {
		expect(DateInputEpochMsSchema.safeParse("2026-13-01").success).toBe(false);
	});
});

describe("picker strings", () => {
	it("round-trip a local calendar day", () => {
		const day = parseDateInputString("2026-10-01");
		expect(day === undefined ? undefined : formatDateInputString(day)).toBe("2026-10-01");
		expect(parseDateInputString("nope")).toBeUndefined();
	});
});

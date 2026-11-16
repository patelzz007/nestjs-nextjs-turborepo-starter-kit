import { describe, expect, it } from "vitest";

import { utcEpochMs } from "../time";

describe("utcEpochMs", () => {
	it("is the epoch milliseconds of a UTC wall-clock moment, with a 1-based month", () => {
		expect(utcEpochMs(2026, 10, 1)).toBe(1_790_812_800_000);
		expect(utcEpochMs(2026, 10, 29, 9, 8)).toBe(1_793_264_880_000);
		expect(utcEpochMs(1970, 1, 1, 0, 0, 1)).toBe(1_000);
	});
});

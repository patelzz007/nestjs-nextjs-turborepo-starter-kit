import { describe, expect, it } from "vitest";

import { RECORD_RETENTION_DAYS, RECORD_RETENTION_MS, RECORD_RETENTION_YEARS } from "../record-retention";

const MS_PER_DAY = 86_400_000;

describe("record retention", () => {
	it("is ten years, counting the most leap days a ten-year span can hold", () => {
		expect(RECORD_RETENTION_YEARS).toBe(10);
		expect(RECORD_RETENTION_DAYS).toBe(3653);
		expect(RECORD_RETENTION_MS).toBe(3653 * MS_PER_DAY);
		// Never shorter than any real ten calendar years.
		const tenYearsFrom2028 = Date.UTC(2038, 0, 1) - Date.UTC(2028, 0, 1);
		expect(RECORD_RETENTION_MS).toBeGreaterThanOrEqual(tenYearsFrom2028);
	});
});

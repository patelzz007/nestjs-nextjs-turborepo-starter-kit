import { describe, expect, it } from "vitest";

import { formatDateInputString, parseDateInputString } from "@workspace/ui/lib/date-input";

describe("date-input", () => {
	it("round-trips yyyy-MM-dd values", () => {
		const date = parseDateInputString("2026-09-08");
		expect(date).toBeDefined();
		expect(formatDateInputString(date!)).toBe("2026-09-08");
	});

	it("rejects invalid date strings", () => {
		expect(parseDateInputString("09/08/2026")).toBeUndefined();
		expect(parseDateInputString("2026-13-40")).toBeUndefined();
	});
});

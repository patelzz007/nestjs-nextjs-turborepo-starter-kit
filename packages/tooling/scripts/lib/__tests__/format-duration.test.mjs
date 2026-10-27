import { describe, expect, it } from "vitest";

import { formatDuration } from "../format-duration.mjs";

describe("formatDuration", () => {
	it("shows tenths of a second under a minute", () => {
		expect(formatDuration(0)).toBe("0.0s");
		expect(formatDuration(7_449)).toBe("7.4s");
		expect(formatDuration(59_940)).toBe("59.9s");
	});

	it("shows minutes and two-digit seconds from a minute on, rounding to the second", () => {
		expect(formatDuration(60_000)).toBe("1m 00s");
		expect(formatDuration(185_400)).toBe("3m 05s");
		expect(formatDuration(119_600)).toBe("2m 00s");
	});
});

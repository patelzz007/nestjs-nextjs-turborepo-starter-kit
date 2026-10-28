import { epochMs } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { percentOf, reporterHealth } from "../policies/health.policy";

describe("reporterHealth", () => {
	it("is UNKNOWN before the first report, UP while reporting and DOWN once silent too long", () => {
		expect(reporterHealth(null, epochMs(1_000), 500)).toBe("UNKNOWN");
		expect(reporterHealth(epochMs(600), epochMs(1_000), 500)).toBe("UP");
		expect(reporterHealth(epochMs(500), epochMs(1_000), 500)).toBe("UP");
		expect(reporterHealth(epochMs(499), epochMs(1_000), 500)).toBe("DOWN");
	});
});

describe("percentOf", () => {
	it("is the share in percent, capped at 100, and 0 of nothing", () => {
		expect(percentOf(1, 4)).toBe(25);
		expect(percentOf(5, 4)).toBe(100);
		expect(percentOf(3, 0)).toBe(0);
	});
});

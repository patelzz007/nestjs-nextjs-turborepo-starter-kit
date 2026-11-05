import { describe, expect, it } from "vitest";

import { coldStartVerdict, forceStopArgs, launchArgs, launchFailureOf, medianMs, parseStartupBudgets, totalTimeMsOf } from "../mobile-cold-start.mjs";

const AM_START_OUTPUT = `Starting: Intent { cmp=com.example.starter/.MainActivity }
Status: ok
LaunchState: COLD
Activity: com.example.starter/.MainActivity
TotalTime: 1234
WaitTime: 1240
Complete
`;

describe("mobile cold start (enhancement 6.6)", () => {
	it("reads the launch time from am start -W, or none when the launch failed", () => {
		expect(totalTimeMsOf(AM_START_OUTPUT)).toBe(1234);
		expect(totalTimeMsOf("Error: Activity class {com.example.starter/.MainActivity} does not exist.")).toBeNull();
	});

	it("takes the median, for odd and even counts, and refuses no samples", () => {
		expect(medianMs([900, 1500, 1000])).toBe(1000);
		expect(medianMs([900, 1500, 1000, 1100])).toBe(1050);
		expect(() => medianMs([])).toThrow(/every launch failed/u);
	});

	it("stops the process (keeping its data), then launches the main activity and waits for the first frame", () => {
		expect(forceStopArgs("com.example.starter")).toEqual(["shell", "am", "force-stop", "com.example.starter"]);
		expect(launchArgs("com.example.starter")).toEqual(["shell", "am", "start", "-W", "-n", "com.example.starter/.MainActivity"]);
	});

	it("reads the budgets file strictly, and checks a median against it", () => {
		const budget = { coldStartMs: 2500, measuredMedianMs: 2270, measuredOn: "API 34 x86_64 emulator, release build", measuredAt: "2026-11-05" };
		expect(parseStartupBudgets(JSON.stringify({ android: budget }))).toEqual({ android: budget });
		expect(() => parseStartupBudgets(JSON.stringify({ android: { ...budget, coldStartMs: -1 } }))).toThrow();
		expect(() => parseStartupBudgets(JSON.stringify({ android: { ...budget, extra: 1 } }))).toThrow();
		// Where it was measured is part of the budget, and the budget is never below its own median.
		expect(() => parseStartupBudgets(JSON.stringify({ android: { coldStartMs: 2500 } }))).toThrow();
		expect(() => parseStartupBudgets(JSON.stringify({ android: { ...budget, coldStartMs: 2000 } }))).toThrow();
		expect(coldStartVerdict(2400, 2500)).toEqual({ ok: true, medianMs: 2400, budgetMs: 2500 });
		expect(coldStartVerdict(2600, 2500).ok).toBe(false);
	});

	it("says why a launch gave no time: its status, or the error it printed", () => {
		expect(launchFailureOf("Starting: Intent { cmp=com.example.starter/.MainActivity }\nStatus: timeout\nComplete\n")).toBe("status timeout");
		expect(launchFailureOf("Error: Activity class {com.example.starter/.MainActivity} does not exist.\n")).toBe(
			"Error: Activity class {com.example.starter/.MainActivity} does not exist.",
		);
		expect(launchFailureOf("")).toBe("no output");
	});
});

import { describe, expect, it } from "vitest";

import { formatSummaryTable } from "../report.mjs";

describe("formatSummaryTable", () => {
	it("prints aligned columns with each phase's description", () => {
		const table = formatSummaryTable([
			{ phase: "A", target: "all", medianMs: 61_234, runs: 3 },
			{ phase: "B", target: "api", medianMs: 4_100, runs: 3 },
		]);
		expect(table.split("\n")).toEqual([
			"Phase  Target  Median ms  Runs  What",
			"-----  ------  ---------  ----  ---------------------------------------",
			"A      all     61234      3     pnpm dev → every port answers",
			"B      api     4100       3     API process spawned → /health/ready 200",
		]);
	});

	it("prints only the header for no measurements", () => {
		expect(formatSummaryTable([]).split("\n")).toEqual(["Phase  Target  Median ms  Runs  What", "-----  ------  ---------  ----  ----"]);
	});
});

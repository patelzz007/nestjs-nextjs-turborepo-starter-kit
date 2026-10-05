import { describe, expect, it } from "vitest";

import { dueExceptions, isIsoCalendarDate, parseDependencyExceptions, structuralProblems } from "./dependency-exceptions.mjs";

const WORKSPACE = `packages:
  - apps/*

minimumReleaseAge: 1440
minimumReleaseAgeExclude:
  # Security fix GHSA-aaaa-bbbb-cccc.
  # Delete this entry on or after 2026-10-05, once past the cooldown.
  - left-pad@2.0.0

overrides:
  foo: "1.0.0"

auditConfig:
  ignoreGhsas:
    # No patched release; reachable only from build tooling.
    # review-by: 2026-11-04
    - GHSA-vfj7-8cjw-p6xm
`;

describe("parseDependencyExceptions", () => {
	it("reads both kinds with their reason and date, and stops at the next top-level key", () => {
		expect(parseDependencyExceptions(WORKSPACE)).toEqual([
			{
				kind: "accepted-advisory",
				id: "GHSA-vfj7-8cjw-p6xm",
				reason: ["No patched release; reachable only from build tooling."],
				date: "2026-11-04",
			},
			{
				kind: "cooldown-exception",
				id: "left-pad@2.0.0",
				reason: ["Security fix GHSA-aaaa-bbbb-cccc.", "Delete this entry on or after 2026-10-05, once past the cooldown."],
				date: "2026-10-05",
			},
		]);
	});

	it("is empty when the workspace records no exceptions", () => {
		expect(parseDependencyExceptions("packages:\n  - apps/*\n")).toEqual([]);
	});
});

describe("structuralProblems", () => {
	it("accepts well-formed entries", () => {
		expect(structuralProblems(parseDependencyExceptions(WORKSPACE))).toEqual([]);
	});

	it("flags a missing reason and a missing or impossible date", () => {
		const broken = `auditConfig:\n  ignoreGhsas:\n    - GHSA-aaaa-bbbb-cccc\nminimumReleaseAgeExclude:\n  # Delete this entry on or after 2026-02-30\n  - x@1.0.0\n`;
		expect(structuralProblems(parseDependencyExceptions(broken))).toEqual([
			"GHSA-aaaa-bbbb-cccc: add a comment above the entry explaining why it is needed",
			"GHSA-aaaa-bbbb-cccc: add a valid date (`# review-by: YYYY-MM-DD`)",
			"x@1.0.0: add a valid date (`Delete this entry on or after YYYY-MM-DD`)",
		]);
	});
});

describe("dueExceptions", () => {
	const exceptions = parseDependencyExceptions(WORKSPACE);

	it("is empty before any date", () => {
		expect(dueExceptions(exceptions, "2026-10-04")).toEqual([]);
	});

	it("reports a cooldown exception from its 'on or after' date", () => {
		expect(dueExceptions(exceptions, "2026-10-05").map((exception) => exception.id)).toEqual(["left-pad@2.0.0"]);
	});

	it("reports an accepted advisory only once its review-by date has passed", () => {
		expect(dueExceptions(exceptions, "2026-11-04").map((exception) => exception.id)).toEqual(["left-pad@2.0.0"]);
		expect(dueExceptions(exceptions, "2026-11-05").map((exception) => exception.id)).toEqual(["GHSA-vfj7-8cjw-p6xm", "left-pad@2.0.0"]);
	});
});

describe("isIsoCalendarDate", () => {
	it.each([
		["2026-10-04", true],
		["2026-02-30", false],
		["2026-1-4", false],
		[null, false],
	])("%s → %s", (value, expected) => {
		expect(isIsoCalendarDate(value)).toBe(expected);
	});
});

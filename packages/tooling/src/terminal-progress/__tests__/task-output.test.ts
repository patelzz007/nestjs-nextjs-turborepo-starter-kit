import { describe, expect, it } from "vitest";

import {
	isCacheHit,
	isPackageFinished,
	parseFailedTasks,
	parseFailedTest,
	parseJestTestTotal,
	parsePackageCount,
	parsePackagesInScope,
	parseStage,
	parseTaskLine,
	parseTestFile,
} from "../task-output.ts";

describe("parseTaskLine", () => {
	it("splits a turbo line into its workspace, task and text", () => {
		expect(parseTaskLine("@workspace/api:test:  ✓ src/a.spec.ts (4 tests) 11ms")).toStrictEqual({
			workspace: "@workspace/api",
			task: "test",
			text: " ✓ src/a.spec.ts (4 tests) 11ms",
		});
	});

	it("reads through colour codes, and leaves other lines alone", () => {
		expect(parseTaskLine("\u001B[32m@workspace/ui:lint: ok\u001B[39m")?.workspace).toBe("@workspace/ui");
		expect(parseTaskLine("   • turbo 2.11.10")).toBeUndefined();
	});
});

describe("parsePackageCount", () => {
	it("reads turbo's plan", () => {
		expect(parsePackageCount("   • Running test in 21 packages")).toBe(21);
		expect(parsePackageCount("   • Running lint in 1 package")).toBe(1);
		expect(parsePackageCount("   • Remote caching disabled")).toBeUndefined();
	});
});

describe("parseTestFile", () => {
	it("reads Vitest's file lines", () => {
		expect(parseTestFile(" ✓ src/a.test.tsx (10 tests) 148ms")).toStrictEqual({ file: "src/a.test.tsx", passed: true, tests: 10, durationMs: 148 });
		expect(parseTestFile(" ✓ src/b.test.ts (1 test) 2ms")?.tests).toBe(1);
		expect(parseTestFile(" ❯ src/c.test.ts (7 tests | 1 failed) 10ms")).toStrictEqual({ file: "src/c.test.ts", passed: false, tests: 7, durationMs: 10 });
	});

	it("reads Jest's file lines, which carry no count", () => {
		expect(parseTestFile("PASS src/a.test.tsx (5.2 s)")).toStrictEqual({ file: "src/a.test.tsx", passed: true, tests: undefined, durationMs: 5200 });
		expect(parseTestFile("FAIL src/b.test.tsx")?.passed).toBe(false);
	});

	it("ignores a single test's line and everything else", () => {
		expect(parseTestFile("      × the light variant meets every minimum 4ms")).toBeUndefined();
		expect(parseTestFile(" Test Files  22 passed (22)")).toBeUndefined();
	});
});

describe("parseJestTestTotal", () => {
	it("reads Jest's closing count, not Vitest's", () => {
		expect(parseJestTestTotal("Tests:       1737 passed, 1737 total")).toBe(1737);
		expect(parseJestTestTotal("Tests:       2 failed, 1 skipped, 10 passed, 13 total")).toBe(10);
		expect(parseJestTestTotal("      Tests  225 passed (225)")).toBeUndefined();
	});
});

describe("parseFailedTasks", () => {
	it("lists the tasks turbo names", () => {
		expect(parseFailedTasks("  Failed:    @workspace/ui#test, @workspace/api#test")).toStrictEqual(["@workspace/ui#test", "@workspace/api#test"]);
		expect(parseFailedTasks("  Tasks:    3 successful")).toStrictEqual([]);
	});
});

describe("parseTestFile durations", () => {
	it("reads seconds, a skipped count, and no time at all", () => {
		expect(parseTestFile(" ✓ src/a.test.ts (3 tests | 1 skipped) 1.5s")?.durationMs).toBe(1500);
		expect(parseTestFile(" ✓ src/a.test.ts (3 tests)")?.durationMs).toBeUndefined();
		expect(parseTestFile("PASS src/b.test.tsx")?.durationMs).toBeUndefined();
	});
});

describe("parsePackagesInScope", () => {
	it("lists turbo's packages, and ignores any other line", () => {
		expect(parsePackagesInScope("   • Packages in scope: @workspace/api, @workspace/ui")).toStrictEqual(["@workspace/api", "@workspace/ui"]);
		expect(parsePackagesInScope("   • Remote caching disabled")).toBeUndefined();
	});
});

describe("parseFailedTest", () => {
	it("names a test from Vitest and from Jest", () => {
		expect(parseFailedTest(" FAIL  src/a.test.ts > login > rejects a bad password")).toBe("src/a.test.ts > login > rejects a bad password");
		expect(parseFailedTest("  ● login › rejects a bad password")).toBe("login › rejects a bad password");
	});

	it("isn't fooled by Jest's console heading or a file result", () => {
		expect(parseFailedTest("  ● Console")).toBeUndefined();
		expect(parseFailedTest("FAIL src/a.test.tsx (5.2 s)")).toBeUndefined();
	});
});

describe("isCacheHit", () => {
	it("knows turbo's replay line", () => {
		expect(isCacheHit("cache hit, replaying logs 698b97512f6f095d")).toBe(true);
		expect(isCacheHit("cache bypass, force executing 40222f574f5da2dd")).toBe(false);
	});
});

describe("isPackageFinished", () => {
	it("knows both runners' closing totals", () => {
		expect(isPackageFinished("  Test Files  10 passed (10)")).toBe(true);
		expect(isPackageFinished("Tests:       3 passed, 3 total")).toBe(true);
		expect(isPackageFinished(" ✓ src/a.test.ts (3 tests) 5ms")).toBe(false);
	});
});

describe("parseStage", () => {
	it("reads lint-staged's marks", () => {
		expect(parseStage("⋯ Preparing lint-staged…")).toStrictEqual({ text: "Preparing lint-staged…", status: "running" });
		expect(parseStage("✔ Done preparing lint-staged!")).toStrictEqual({ text: "Done preparing lint-staged!", status: "passed" });
		expect(parseStage("✖ oxlint failed")).toStrictEqual({ text: "oxlint failed", status: "failed" });
		expect(parseStage("↓ Skipped")).toStrictEqual({ text: "Skipped", status: "skipped" });
	});

	it("shortens a staged-lint command to its tool and folder", () => {
		expect(parseStage('✔ node packages/tooling/src/run-in-workspace/cli.ts "apps/web" oxlint --no-error-on-unmatched-pattern "src/a.ts"')?.text).toBe("oxlint in apps/web");
	});

	it("ignores any other line", () => {
		expect(parseStage("    *.ts — 1 file")).toBeUndefined();
	});
});

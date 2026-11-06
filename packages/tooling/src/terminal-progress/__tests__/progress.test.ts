import { describe, expect, it } from "vitest";

import {
	applyLine,
	finishCheck,
	packagesCached,
	packagesStarted,
	problemCount,
	RECENT_TEST_FILES,
	SLOWEST_TEST_FILES,
	startCheck,
	waitingCheck,
	type CheckProgress,
} from "../progress.ts";

const test = waitingCheck("test", "Unit tests", "test");
const NOW = 1000;

function feed(check: CheckProgress, lines: readonly string[]): CheckProgress {
	return lines.reduce((current, line) => applyLine(current, line, NOW), check);
}

describe("applyLine", () => {
	it("takes the package count and names from turbo's plan", () => {
		const planned = feed(test, ["   • Packages in scope: @workspace/api, @workspace/ui", "   • Running test in 2 packages"]);

		expect(planned.packagesTotal).toBe(2);
		expect([...planned.packages.keys()]).toStrictEqual(["@workspace/api", "@workspace/ui"]);
		expect(packagesStarted(planned)).toBe(0);
	});

	it("keeps what it knew about a package if the plan is printed after it", () => {
		const seen = feed(test, ["@workspace/api:test: $ vitest run", "   • Packages in scope: @workspace/api"]);

		expect(packagesStarted(seen)).toBe(1);
	});

	it("counts the check's own task and ignores the tasks it depends on", () => {
		const built = applyLine(test, "@workspace/shared:build: compiled", NOW);
		expect(built.packages.size).toBe(0);

		const running = applyLine(built, "@workspace/api:test: $ vitest run", NOW);
		expect(running.currentWorkspace).toBe("@workspace/api");
		expect(packagesStarted(running)).toBe(1);
	});

	it("counts test files and tests, overall and per package", () => {
		const check = feed(test, [
			"@workspace/api:test:  ✓ src/a.spec.ts (4 tests) 11ms",
			"@workspace/api:test:  ✓ src/b.spec.ts (2 tests) 9ms",
			"@workspace/ui:test:  ✓ src/c.test.tsx (1 test) 2ms",
		]);

		expect(check.testFiles).toBe(3);
		expect(check.tests).toBe(7);
		expect(check.packages.get("@workspace/api")).toMatchObject({ testFiles: 2, tests: 6 });
		expect(check.recent.map((file) => file.workspace)).toStrictEqual(["@workspace/api", "@workspace/api", "@workspace/ui"]);
	});

	it("adds Jest's closing count to the package that printed it", () => {
		const check = feed(test, ["@workspace/mobile:test: PASS src/a.test.tsx", "@workspace/mobile:test: Tests:       5 passed, 5 total"]);

		expect(check.tests).toBe(5);
		expect(check.packages.get("@workspace/mobile")).toMatchObject({ tests: 5, finished: true });
	});

	it("keeps only the newest files, and the slowest in order", () => {
		const lines = Array.from({ length: RECENT_TEST_FILES + 1 }, (_, index) => `@workspace/api:test:  ✓ src/${String(index)}.spec.ts (1 test) ${String(index)}ms`);
		const check = feed(test, lines);

		expect(check.recent).toHaveLength(RECENT_TEST_FILES);
		expect(check.recent.at(0)?.file).toBe("src/1.spec.ts");
		expect(check.slowest).toHaveLength(SLOWEST_TEST_FILES);
		expect(check.slowest.at(0)?.durationMs).toBe(RECENT_TEST_FILES);
	});

	it("leaves a file with no time out of the slowest", () => {
		expect(feed(test, ["@workspace/mobile:test: PASS src/a.test.tsx"]).slowest).toStrictEqual([]);
	});

	it("notes a package replayed from the cache", () => {
		const check = feed(waitingCheck("lint", "Lint", "lint"), ["@workspace/ui:lint: cache hit, replaying logs 698b", "@workspace/api:lint: cache miss, executing 7d51"]);

		expect(packagesCached(check)).toBe(1);
	});

	it("records a failure the moment it prints, once each, against its package", () => {
		const check = feed(test, [
			"@workspace/api:test:  ❯ src/a.spec.ts (2 tests | 1 failed) 5ms",
			"@workspace/api:test:  FAIL  src/a.spec.ts > login > rejects",
			"@workspace/mobile:test:   ● login › rejects",
			"@workspace/mobile:test:   ● login › rejects",
		]);

		expect(check.failedFiles.map((file) => file.file)).toStrictEqual(["src/a.spec.ts"]);
		expect(check.failedTests).toStrictEqual(["src/a.spec.ts > login > rejects", "login › rejects"]);
		expect(check.packages.get("@workspace/api")?.failed).toBe(true);
		expect(check.packages.get("@workspace/mobile")?.failed).toBe(true);
		expect(check.testFiles).toBe(1);
	});

	it("marks the packages turbo names as failed, for this task only", () => {
		const check = feed(waitingCheck("lint", "Lint", "lint"), ["  Failed:    @workspace/ui#lint, @workspace/api#build"]);

		expect(check.packages.get("@workspace/ui")?.failed).toBe(true);
		expect(check.packages.has("@workspace/api")).toBe(false);
	});

	it("collects lint-staged's steps for a check that isn't a turbo task", () => {
		const check = feed(waitingCheck("lint-staged", "Format, lint", undefined), ["⋯ Preparing lint-staged…", "not a step", "✔ Done preparing lint-staged!"]);

		expect(check.stages.map((stage) => stage.status)).toStrictEqual(["running", "passed"]);
	});
});

describe("finishCheck", () => {
	it("records the time, the result and what the failure printed", () => {
		const finished = finishCheck(startCheck(test, 1000), false, 4000, ["broke"]);

		expect(finished).toMatchObject({ status: "failed", elapsedMs: 3000, failureLog: ["broke"], currentWorkspace: undefined });
	});
});

describe("problemCount", () => {
	it("counts the most specific thing each check knows", () => {
		const tests = feed(test, ["@workspace/api:test:  FAIL  src/a.spec.ts > one", "@workspace/api:test:  FAIL  src/a.spec.ts > two"]);
		const lint = finishCheck(startCheck(waitingCheck("lint", "Lint", "lint"), 0), false, 1);

		expect(problemCount([tests, lint, waitingCheck("x", "X", undefined)])).toBe(3);
	});
});

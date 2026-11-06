import { describe, expect, it } from "vitest";

import { parseFailedTasks, parseJestTestTotal, parsePackageCount, parseTaskLine, parseTestFile } from "../task-output.ts";

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
		expect(parseTestFile(" ✓ src/a.test.tsx (10 tests) 148ms")).toStrictEqual({ file: "src/a.test.tsx", passed: true, tests: 10 });
		expect(parseTestFile(" ✓ src/b.test.ts (1 test) 2ms")?.tests).toBe(1);
		expect(parseTestFile(" ❯ src/c.test.ts (7 tests | 1 failed) 10ms")).toStrictEqual({ file: "src/c.test.ts", passed: false, tests: 7 });
	});

	it("reads Jest's file lines, which carry no count", () => {
		expect(parseTestFile("PASS src/a.test.tsx (5.2 s)")).toStrictEqual({ file: "src/a.test.tsx", passed: true, tests: undefined });
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

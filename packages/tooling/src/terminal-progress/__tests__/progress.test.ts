import { describe, expect, it } from "vitest";

import { applyLine, finishCheck, RECENT_TEST_FILES, startCheck, waitingCheck } from "../progress.ts";

const test = waitingCheck("test", "Unit tests", "test");

describe("applyLine", () => {
	it("takes the package count from turbo's plan", () => {
		expect(applyLine(test, "   • Running test in 21 packages").packagesTotal).toBe(21);
	});

	it("counts the check's own task and ignores the tasks it depends on", () => {
		const built = applyLine(test, "@workspace/shared:build: compiled");
		expect(built.packagesSeen.size).toBe(0);

		const running = applyLine(built, "@workspace/api:test: $ vitest run");
		expect(running.currentWorkspace).toBe("@workspace/api");
		expect([...running.packagesSeen]).toStrictEqual(["@workspace/api"]);
	});

	it("adds up finished files and their tests, keeping only the latest on screen", () => {
		const files = Array.from({ length: RECENT_TEST_FILES + 2 }, (_, index) => `@workspace/api:test:  ✓ src/f${String(index)}.spec.ts (3 tests) 1ms`);
		const done = files.reduce(applyLine, test);

		expect(done.testFiles).toBe(RECENT_TEST_FILES + 2);
		expect(done.tests).toBe((RECENT_TEST_FILES + 2) * 3);
		expect(done.recent).toHaveLength(RECENT_TEST_FILES);
		expect(done.recent.at(-1)?.file).toBe(`src/f${String(RECENT_TEST_FILES + 1)}.spec.ts`);
	});

	it("takes Jest's test count from its closing line", () => {
		const done = ["@workspace/mobile:test: PASS src/a.test.tsx", "@workspace/mobile:test: Tests:       12 passed, 12 total"].reduce(applyLine, test);

		expect(done.testFiles).toBe(1);
		expect(done.tests).toBe(12);
	});
});

describe("finishCheck", () => {
	it("records how long it ran and how it ended", () => {
		expect(finishCheck(startCheck(test, 1000), true, 3500)).toMatchObject({ status: "passed", elapsedMs: 2500 });
		expect(finishCheck(startCheck(test, 1000), false, 1100).status).toBe("failed");
		expect(finishCheck(test, true, 1000).elapsedMs).toBe(0);
	});
});

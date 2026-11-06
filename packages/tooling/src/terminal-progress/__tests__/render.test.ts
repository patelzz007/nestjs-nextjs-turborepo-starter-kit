import { describe, expect, it } from "vitest";

import { applyLine, finishCheck, startCheck, waitingCheck, type CheckProgress } from "../progress.ts";
import { renderFailed, renderFrame, renderPassed, SPINNER_FRAMES, type Tint } from "../render.ts";

const PLAIN: Tint = { title: String, active: String, pass: String, fail: String, quiet: String };
const WIDTH = 80;

function frame(checks: readonly CheckProgress[], width = WIDTH): string[] {
	return renderFrame({ title: "Checking your push", subtitle: "The same checks as CI", checks, frame: 0, nowMs: 5000, width, tint: PLAIN });
}

const running = ["   • Running test in 21 packages", "@workspace/api:test:  ✓ src/contexts/identity/login.handler.spec.ts (14 tests) 9ms"].reduce(
	applyLine,
	startCheck(waitingCheck("test", "Unit tests", "test"), 2000),
);

describe("renderFrame", () => {
	it("shows the title, then each check with its state", () => {
		const lint = finishCheck(startCheck(waitingCheck("lint", "Lint", "lint"), 0), true, 9000);
		const text = frame([lint, running, waitingCheck("later", "Later", undefined)]).join("\n");

		expect(text).toContain("◆ Checking your push");
		expect(text).toMatch(/✓ Lint .* 9\.0s/u);
		expect(text).toContain(`${SPINNER_FRAMES.at(0) ?? ""} Unit tests`);
		expect(text).toContain("○ Later");
	});

	it("shows a fixed note, and no package row for a check without packages", () => {
		const noted = startCheck(waitingCheck("commit", "Format, lint", undefined, "12 staged files"), 2000);
		const bare = startCheck(waitingCheck("bare", "Bare", undefined), 2000);

		expect(frame([noted]).join("\n")).toContain("12 staged files");
		expect(frame([bare]).join("\n")).not.toContain("package");
	});

	it("marks a check that failed, and counts packages once one has finished", () => {
		const text = frame([finishCheck(running, false, 3000)]).join("\n");

		expect(text).toContain("✗ Unit tests");
		expect(text).toContain("21 packages");
	});

	it("shows nothing beside a check that hasn't started", () => {
		const planned = applyLine(waitingCheck("test", "Unit tests", "test"), "   • Running test in 21 packages");

		expect(frame([planned]).join("\n")).not.toContain("21");
	});

	it("drops the test count on a narrow terminal, to leave room for the path", () => {
		expect(frame([running], 50).join("\n")).not.toContain("14 tests  ");
	});

	it("shows the running package and the test files as they finish", () => {
		const text = frame([running]).join("\n");

		expect(text).toContain("1/21");
		expect(text).toContain("@workspace/api");
		expect(text).toContain("✓ src/contexts/identity/login.handler.spec.ts");
		expect(text).toContain("14 tests");
		expect(text).toContain("1 file · 14 tests so far");
	});

	it("marks a failed test file", () => {
		const failed = applyLine(running, "@workspace/api:test:  ❯ src/broken.spec.ts (2 tests | 1 failed) 3ms");

		expect(frame([failed]).join("\n")).toContain("✗ src/broken.spec.ts");
	});

	it("never prints a line wider than the terminal, which would break the redraw", () => {
		const long = applyLine(running, `@workspace/api:test:  ✓ src/${"nested/".repeat(30)}file.spec.ts (1 test) 1ms`);

		for (const width of [40, WIDTH]) {
			for (const line of frame([long], width)) {
				expect(line.length).toBeLessThanOrEqual(width);
			}
		}
	});

	it("keeps the file's name when a path has to be cut", () => {
		const long = applyLine(running, `@workspace/api:test:  ✓ src/${"nested/".repeat(30)}file.spec.ts (1 test) 1ms`);

		expect(frame([long]).join("\n")).toContain("…");
		expect(frame([long]).join("\n")).toContain("file.spec.ts");
	});
});

describe("closing lines", () => {
	it("sums the run up", () => {
		expect(renderPassed([running], 700_000, PLAIN)).toContain("All clear in 11m 40s  1 test file · 14 tests");
	});

	it("names what failed", () => {
		expect(renderFailed([finishCheck(running, false, 3000)], PLAIN)).toContain("Stopped: Unit tests failed");
	});
});

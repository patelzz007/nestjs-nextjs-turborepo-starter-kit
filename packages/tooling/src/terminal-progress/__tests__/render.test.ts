import { describe, expect, it } from "vitest";

import { INITIAL_DASHBOARD } from "../dashboard.ts";
import { buildPanel, type Panel } from "../panels.ts";
import { applyLine, finishCheck, startCheck, waitingCheck, type CheckProgress } from "../progress.ts";
import { panelHeight, renderCancelled, renderFailed, renderFrame, renderPassed, renderSummary, SPINNER_FRAMES, type FrameView } from "../render.ts";
import type { Tint } from "../text.ts";

const PLAIN: Tint = { title: String, active: String, pass: String, fail: String, warn: String, quiet: String };
const WIDTH = 80;
const HEIGHT = 30;
const NOW = 5000;

function panelFor(checks: readonly CheckProgress[], width: number, state = INITIAL_DASHBOARD): Panel {
	return buildPanel(state, { checks, log: [], changes: { headline: "", commits: [], files: [] } }, { width, tint: PLAIN, nowMs: NOW, spinner: "⠋" });
}

function frame(checks: readonly CheckProgress[], overrides: Partial<FrameView> = {}): string[] {
	return renderFrame({
		title: "Checking your push",
		headline: "main → origin/main · 2 commits",
		action: "push",
		checks,
		panel: panelFor(checks, WIDTH),
		estimate: { fraction: 0.25, remainingMs: 90_000 },
		frame: 0,
		elapsedMs: 30_000,
		nowMs: NOW,
		width: WIDTH,
		height: HEIGHT,
		tint: PLAIN,
		state: INITIAL_DASHBOARD,
		keysEnabled: true,
		stopping: false,
		...overrides,
	});
}

const running = ["   • Running test in 21 packages", "@workspace/api:test:  ✓ src/contexts/identity/login.handler.spec.ts (14 tests) 9ms"].reduce(
	(check, line) => applyLine(check, line, NOW),
	startCheck(waitingCheck("test", "Unit tests", "test"), 2000),
);

describe("renderFrame", () => {
	it("shows the title, what's being checked, the time left and each check", () => {
		const lint = finishCheck(startCheck(waitingCheck("lint", "Lint", "lint"), 0), true, 9000);
		const text = frame([lint, running, waitingCheck("later", "Later", undefined)]).join("\n");

		expect(text).toContain("◆ Checking your push");
		expect(text).toContain("main → origin/main · 2 commits");
		expect(text).toContain("about 1m 30s left");
		expect(text).toContain("25%");
		expect(text).toMatch(/✓ Lint .* 9\.0s/u);
		expect(text).toContain(`${SPINNER_FRAMES.at(0) ?? ""} Unit tests`);
		expect(text).toContain("○ Later");
	});

	it("says so when there is no estimate, or the run has outlasted it", () => {
		expect(frame([running], { estimate: { fraction: 0, remainingMs: undefined } }).join("\n")).toContain("no estimate on a first run");
		expect(frame([running], { estimate: { fraction: 1, remainingMs: 0 } }).join("\n")).toContain("taking longer than last time");
	});

	it("shows a running check's package and how far it has got", () => {
		const text = frame([running]).join("\n");

		expect(text).toContain("1/21  api");
		expect(text).toContain("login.handler.spec.ts");
		expect(text).toContain("1 file · 14 tests");
	});

	it("shows a fixed note, and no package row for a check without packages", () => {
		const noted = startCheck(waitingCheck("commit", "Format, lint", undefined, "12 staged files"), 2000);
		const bare = startCheck(waitingCheck("bare", "Bare", undefined), 2000);

		expect(frame([noted]).join("\n")).toContain("12 staged files");
		expect(frame([waitingCheck("commit", "Format, lint", undefined, "12 staged files")]).join("\n")).toContain("12 staged files");
		expect(frame([bare]).join("\n")).not.toContain("package");
	});

	it("marks a check that failed, says how many problems, and puts the count on the tab", () => {
		const text = frame([finishCheck(running, false, 3000)]).join("\n");

		expect(text).toContain("✗ Unit tests");
		expect(text).toContain("1 problem");
		expect(text).toContain("4 Problems 1");
	});

	it("says what a finished check did, cached packages included", () => {
		const lint = ["   • Running lint in 2 packages", "@workspace/ui:lint: cache hit, replaying logs 698b"].reduce(
			(check, line) => applyLine(check, line, NOW),
			startCheck(waitingCheck("lint", "Lint", "lint"), 0),
		);
		const plain = applyLine(startCheck(waitingCheck("lint", "Lint", "lint"), 0), "   • Running lint in 2 packages", NOW);

		expect(frame([finishCheck(lint, true, 100)]).join("\n")).toContain("2 packages · 1 cached");
		expect(frame([finishCheck(plain, true, 100)]).join("\n")).toContain("2 packages");
		expect(frame([finishCheck(running, true, 100)]).join("\n")).toContain("1 file · 14 tests");
		expect(frame([finishCheck(startCheck(waitingCheck("a", "A", undefined, "a note"), 0), true, 1)]).join("\n")).toContain("a note");
	});

	it("marks the view on screen", () => {
		expect(frame([running], { state: { ...INITIAL_DASHBOARD, view: "packages" } }).join("\n")).toContain("[2 Packages]");
	});

	it("is never taller than the terminal, and fills it exactly when there is room", () => {
		expect(frame([running], { height: HEIGHT })).toHaveLength(HEIGHT);
		expect(frame([running], { height: 40 })).toHaveLength(40);
	});

	it("drops the panel in a small terminal, and keeps the checks", () => {
		const small = frame([running], { height: 8 });

		expect(small.length).toBeLessThanOrEqual(8);
		expect(small.join("\n")).toContain("Unit tests");
		expect(small.join("\n")).not.toContain("Packages");
	});

	it("keeps every row to the terminal's width", () => {
		const narrow = 50;
		const lines = frame([running], { width: narrow, panel: panelFor([running], narrow) });

		expect(lines.filter((line) => line.length > narrow)).toStrictEqual([]);
	});

	it("keeps every tab reachable in a narrow terminal, the one on screen named", () => {
		const text = frame([running], { width: 50 }).join("\n");

		expect(text).toContain("[1 Live]  2   3   4   5   6");
	});

	it("shows the keys, the question, the stopping note, or what still works with no keyboard", () => {
		expect(frame([running]).join("\n")).toContain("q cancel");
		expect(frame([running], { state: { ...INITIAL_DASHBOARD, confirmingCancel: true } }).join("\n")).toContain("Cancel the push? Press q again");
		expect(frame([running], { stopping: true }).join("\n")).toContain("Stopping the checks…");
		expect(frame([running], { keysEnabled: false }).join("\n")).toContain("Ctrl+C to cancel the push");
	});

	it("names the package a log is narrowed to, and how to get back", () => {
		const text = frame([running], { state: { ...INITIAL_DASHBOARD, view: "log", logFilter: "@workspace/api" } }).join("\n");

		expect(text).toContain("── api only ──");
		expect(text).toContain("esc all packages");
	});

	it("shows an empty panel's message, and keeps the packages selection in sight", () => {
		const empty: Panel = { length: 0, tail: false, empty: "Nothing yet", row: () => "", packageAt: () => undefined };
		const long: Panel = { length: 100, tail: false, empty: "", row: (index) => `row ${String(index)}`, packageAt: () => undefined };

		expect(frame([running], { panel: empty }).join("\n")).toContain("Nothing yet");
		expect(frame([running], { panel: long, state: { ...INITIAL_DASHBOARD, view: "packages", selected: 60 } }).join("\n")).toContain("row 60");
	});

	it("follows a tail, and stays put once scrolled", () => {
		const tail: Panel = { length: 100, tail: true, empty: "", row: (index) => `row ${String(index)}`, packageAt: () => undefined };

		expect(frame([running], { panel: tail }).join("\n")).toContain("row 99");
		expect(frame([running], { panel: tail, state: { ...INITIAL_DASHBOARD, top: 3 } }).join("\n")).toContain("row 3");
	});
});

describe("panelHeight", () => {
	it("gives the panel what the rest leaves, or nothing when that's too little", () => {
		expect(panelHeight(30, 3)).toBe(17);
		expect(panelHeight(14, 3)).toBe(0);
	});
});

describe("closing lines", () => {
	it("sums the run up when it passes", () => {
		expect(renderPassed([running], 90_000, PLAIN)).toBe("  ✓ All clear in 1m 30s  1 test file · 14 tests");
		expect(renderPassed([waitingCheck("a", "A", undefined)], 1000, PLAIN)).toBe("  ✓ All clear in 1.0s");
	});

	it("names what failed", () => {
		expect(renderFailed([finishCheck(running, false, 3000)], PLAIN)).toBe("  ✗ Stopped: Unit tests failed");
	});

	it("says a cancelled run did nothing", () => {
		expect(renderCancelled(2000, "The push did not happen.", PLAIN)).toBe("  ■ Cancelled after 2.0s  The push did not happen.");
	});
});

describe("renderSummary", () => {
	const finished = finishCheck(running, true, 4000);
	const view = { headline: "main → origin/main", checks: [finished], width: WIDTH, tint: PLAIN, totalMs: 60_000, previousMs: undefined };

	it("keeps what was checked, each check, and the slowest files", () => {
		const text = renderSummary(view).join("\n");

		expect(text).toContain("main → origin/main");
		expect(text).toMatch(/✓ Unit tests .* 1 file · 14 tests .* 2\.0s/u);
		expect(text).toContain("Slowest");
		expect(text).toContain("login.handler.spec.ts");
	});

	it("compares with the last run only when the difference is worth saying", () => {
		expect(renderSummary({ ...view, previousMs: 120_000 }).join("\n")).toContain("1m 00s faster than last time");
		expect(renderSummary({ ...view, previousMs: 30_000 }).join("\n")).toContain("30.0s slower than last time");
		expect(renderSummary({ ...view, previousMs: 61_000 }).join("\n")).not.toContain("than last time");
	});

	it("leaves the slowest out when nothing was timed", () => {
		expect(renderSummary({ ...view, checks: [waitingCheck("a", "A", undefined)] }).join("\n")).not.toContain("Slowest");
	});
});

import { describe, expect, it } from "vitest";

import { INITIAL_DASHBOARD } from "../dashboard.ts";
import { buildPanel, type Panel } from "../panels.ts";
import { applyLine, finishCheck, startCheck, waitingCheck, type CheckProgress } from "../progress.ts";
import {
	panelHeight,
	panelWidth,
	renderCancelled,
	renderFailed,
	renderFrame,
	renderPassed,
	renderRerun,
	renderSummary,
	sparkline,
	SPINNER_FRAMES,
	windowTitle,
	type FrameView,
} from "../render.ts";
import type { Tint } from "../text.ts";

const PLAIN: Tint = { title: String, active: String, pass: String, fail: String, warn: String, quiet: String };
const WIDTH = 80;
const HEIGHT = 30;
const NOW = 5000;

function panelFor(checks: readonly CheckProgress[], width: number, state = INITIAL_DASHBOARD): Panel {
	return buildPanel(state, { checks, log: [], changes: { headline: "", commits: [], files: [] } }, { width: panelWidth(width), tint: PLAIN, nowMs: NOW, spinner: "⠋" });
}

function rowsPanel(length: number, tail: boolean): Panel {
	return { length, tail, empty: "", row: (index) => `row ${String(index)}`, packageAt: () => undefined };
}

function frame(checks: readonly CheckProgress[], overrides: Partial<FrameView> = {}): string[] {
	return renderFrame({
		title: "Checking your push",
		headline: "main → origin/main · 2 commits",
		action: "push",
		checks,
		panel: panelFor(checks, WIDTH),
		estimate: { fraction: 0.25, remainingMs: 90_000 },
		throughput: [],
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
		const tail = rowsPanel(100, true);

		expect(frame([running], { panel: tail }).join("\n")).toContain("row 99");
		expect(frame([running], { panel: tail, state: { ...INITIAL_DASHBOARD, top: 3 } }).join("\n")).toContain("row 3");
	});

	it("leaves a blank row between the panel and the key bar", () => {
		const lines = frame([running]);

		expect(lines.at(-2)).toBe("");
		expect(lines.at(-1)).toContain("q cancel");
	});

	it("says where a long panel is scrolled to, with a scrollbar, and none when it all fits", () => {
		const height = panelHeight(HEIGHT, 1);
		const following = frame([running], { panel: rowsPanel(100, true) }).join("\n");
		const top = frame([running], { panel: rowsPanel(100, false) });

		expect(following).toContain(`${String(100 - height + 1)}–100 of 100`);
		expect(following).not.toContain("paused");
		expect(top.join("\n")).toContain(`1–${String(height)} of 100`);
		expect(top.filter((line) => line.endsWith("┃"))).toHaveLength(Math.round((height * height) / 100));
		expect(top.filter((line) => line.endsWith("│")).length).toBeGreaterThan(0);
		expect(frame([running], { panel: rowsPanel(2, false) }).join("\n")).not.toMatch(/[┃│]$/mu);
		expect(frame([running], { panel: rowsPanel(2, false) }).join("\n")).not.toContain(" of 2");
	});

	it("says a tail has stopped following once scrolled up, and how to follow it again", () => {
		expect(frame([running], { panel: rowsPanel(100, true), state: { ...INITIAL_DASHBOARD, top: 3 } }).join("\n")).toContain("paused · G follows · 4–");
	});

	it("drops the keys that don't fit, keeping shorter ones and always cancel", () => {
		const narrow = 30;
		const bar = frame([running], { width: narrow, panel: panelFor([running], narrow) }).at(-1) ?? "";

		expect(bar).toBe("  ←→ views   ? keys   q cancel");
		expect(frame([running]).at(-1)).toBe("  ←→ views   ↑↓ scroll   G newest   ? keys   q cancel");
	});

	it("shows the selection keys in the packages view, and how to close the key list", () => {
		expect(frame([running], { state: { ...INITIAL_DASHBOARD, view: "packages" } }).at(-1)).toContain("enter its log");
		const help = frame([running], { state: { ...INITIAL_DASHBOARD, help: true } });

		expect(help.at(-1)).toContain("? close");
		expect(help.join("\n")).toContain("── keys ──");
		expect(help.join("\n")).not.toContain("[1 Live]");
	});

	it("shows how many test files finish a second once any have", () => {
		expect(frame([running], { throughput: [0, 2, 4, 8] }).join("\n")).toContain("▁▃▅█ 4/s");
		expect(frame([running], { throughput: [0, 0] }).join("\n")).not.toContain("/s");
		expect(frame([running], { throughput: [8], width: 40, panel: panelFor([running], 40) }).join("\n")).not.toContain("/s");
	});
});

describe("sparkline", () => {
	it("draws each value against the largest, and a flat line for none", () => {
		expect(sparkline([0, 1, 2, 4])).toBe("▁▃▅█");
		expect(sparkline([0, 0])).toBe("▁▁");
		expect(sparkline([])).toBe("");
	});
});

describe("windowTitle", () => {
	it("leads with how far along the run is, and the problems once there are any", () => {
		expect(windowTitle("Checking your push", [running], { fraction: 0.426, remainingMs: undefined })).toBe("42% · Checking your push");
		expect(windowTitle("Checking your push", [finishCheck(running, false, 1)], { fraction: 1, remainingMs: 0 })).toBe("✗ 1 problem · 100% · Checking your push");
	});
});

describe("panelHeight", () => {
	it("gives the panel what the rest leaves, or nothing when that's too little", () => {
		expect(panelHeight(30, 3)).toBe(16);
		expect(panelHeight(14, 3)).toBe(0);
	});
});

describe("panelWidth", () => {
	it("leaves room for the scrollbar", () => {
		expect(panelWidth(80)).toBe(78);
		expect(panelWidth(1)).toBe(0);
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

describe("renderRerun", () => {
	it("names a turbo command for each package that failed, and nothing when none did", () => {
		const failed = finishCheck(applyLine(running, " Failed:    @workspace/api#test", NOW), false, NOW);

		expect(renderRerun([failed], PLAIN)).toStrictEqual(["  Rerun just what failed:", "    $ pnpm turbo run test --filter=@workspace/api"]);
		expect(renderRerun([running, finishCheck(startCheck(waitingCheck("commit", "Format, lint", undefined), 0), false, 1)], PLAIN)).toStrictEqual([]);
	});
});

describe("renderSummary", () => {
	const finished = finishCheck(running, true, 4000);
	const view = { headline: "main → origin/main", checks: [finished], width: WIDTH, tint: PLAIN, records: [] };

	it("keeps what was checked, each check, and the slowest files, in a card", () => {
		const lines = renderSummary(view);
		const text = lines.join("\n");

		expect(text).toContain("main → origin/main");
		expect(text).toMatch(/│ ✓ Unit tests .* 1 file · 14 tests .* 2\.0s +│/u);
		expect(text).toContain("Slowest");
		// The package column is at least four wide, then a two-space gap; a file's time keeps its milliseconds.
		expect(text).toContain("  9ms  api   src/contexts/identity/login.handler.spec.ts");
		expect(text).toContain("╭");
		expect(text).toContain("╰");
	});

	it("draws every row of the card to the same width", () => {
		const widths = new Set(
			renderSummary({ ...view, records: ["★ New best time"] })
				.filter((line) => line.length > 0)
				.map((line) => line.length),
		);

		expect(widths).toStrictEqual(new Set([WIDTH]));
	});

	it("shows the run's records", () => {
		expect(renderSummary({ ...view, records: ["★ New best time, 1m 00s (was 1m 40s)", "● 3 green runs in a row"] }).join("\n")).toMatch(/New best time[\s\S]*3 green runs/u);
		expect(renderSummary(view).join("\n")).not.toContain("★");
	});

	it("leaves the slowest out when nothing was timed", () => {
		expect(renderSummary({ ...view, checks: [waitingCheck("a", "A", undefined)] }).join("\n")).not.toContain("Slowest");
	});
});

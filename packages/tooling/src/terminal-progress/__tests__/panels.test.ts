import { describe, expect, it } from "vitest";

import type { ChangeSummary } from "../change-summary.ts";
import { INITIAL_DASHBOARD, type DashboardState, type ViewId } from "../dashboard.ts";
import { buildPanel, type LogLine, type Panel } from "../panels.ts";
import { applyLine, finishCheck, startCheck, waitingCheck, type CheckProgress } from "../progress.ts";
import type { Tint } from "../text.ts";

const PLAIN: Tint = { title: String, active: String, pass: String, fail: String, warn: String, quiet: String };
const NO_CHANGES: ChangeSummary = { headline: "", commits: [], files: [] };

function feed(task: string | undefined, lines: readonly string[]): CheckProgress {
	return lines.reduce((current, line) => applyLine(current, line, 2000), startCheck(waitingCheck("test", "Unit tests", task), 1000));
}

function check(lines: readonly string[]): CheckProgress {
	return feed("test", lines);
}

function panel(
	view: ViewId,
	checks: readonly CheckProgress[],
	options: { log?: readonly LogLine[]; changes?: ChangeSummary; state?: Partial<DashboardState>; width?: number } = {},
): Panel {
	return buildPanel(
		{ ...INITIAL_DASHBOARD, view, ...options.state },
		{ checks, log: options.log ?? [], changes: options.changes ?? NO_CHANGES },
		{ width: options.width ?? 100, tint: PLAIN, nowMs: 3000, spinner: "⠋" },
	);
}

function rows(target: Panel): string {
	return Array.from({ length: target.length }, (_, index) => target.row(index)).join("\n");
}

describe("live", () => {
	it("lists finished test files with their package, count and time", () => {
		const text = rows(
			panel("live", [
				check([
					"@workspace/api:test:  ✓ src/a.spec.ts (4 tests) 11ms",
					"@workspace/ui:test:  ✓ src/b.test.tsx (2 tests) 2.5s",
					"@workspace/ui:test:  ❯ src/c.test.tsx (2 tests | 1 failed) 8ms",
				]),
			]),
		);

		expect(text).toMatch(/✓ api\s+src\/a\.spec\.ts\s+4 tests\s+11ms/u);
		expect(text).toMatch(/2 tests\s+2\.5s/u);
		expect(text).toMatch(/✗ ui\s+src\/c\.test\.tsx/u);
	});

	it("gives a narrow terminal just the path", () => {
		const text = rows(panel("live", [check(["@workspace/api:test:  ✓ src/a.spec.ts (4 tests) 11ms"])], { width: 40 }));

		expect(text).toContain("src/a.spec.ts");
		expect(text).not.toContain("api");
	});

	it("shows Jest files, which often have no time", () => {
		expect(rows(panel("live", [check(["@workspace/mobile:test: PASS src/a.test.tsx"])]))).toContain("src/a.test.tsx");
	});

	it("shows lint-staged's steps as they go", () => {
		const text = rows(panel("live", [feed(undefined, ["⋯ Preparing…", "✔ Prepared", "✖ Broke", "↓ Skipped"])]));

		expect(text).toContain("⠋ Preparing…");
		expect(text).toContain("✓ Prepared");
		expect(text).toContain("✗ Broke");
		expect(text).toContain("↓ Skipped");
	});

	it("falls back to the raw output, and keeps the last check's files when it's all over", () => {
		const log: readonly LogLine[] = [
			{ workspace: "@workspace/ui", text: "Checking formatting..." },
			{ workspace: undefined, text: "  " },
		];
		const done = finishCheck(check(["@workspace/api:test:  ✓ src/a.spec.ts (4 tests) 11ms"]), true, 2000);

		expect(panel("live", [check([])], { log }).length).toBe(1);
		expect(rows(panel("live", [check([])], { log }))).toContain("Checking formatting...");
		expect(rows(panel("live", [done]))).toContain("src/a.spec.ts");
		expect(panel("live", [waitingCheck("a", "A", undefined)]).empty).toBe("Starting…");
	});
});

describe("packages", () => {
	const lines = [
		"   • Packages in scope: @workspace/api, @workspace/cached, @workspace/done, @workspace/failed, @workspace/waiting",
		"@workspace/api:test: $ vitest",
		"@workspace/cached:test: cache hit, replaying logs 698b",
		"@workspace/done:test:  ✓ src/a.spec.ts (4 tests) 11ms",
		"@workspace/done:test:   Test Files  1 passed (1)",
		"@workspace/failed:test:  FAIL  src/b.spec.ts > one",
	];

	it("says where each package has got to while the check runs", () => {
		const text = rows(panel("packages", [check(lines)]));

		expect(text).toMatch(/⠋ api\s+running/u);
		expect(text).toMatch(/✓ cached\s+cached/u);
		expect(text).toMatch(/✓ done\s+passed\s+1 file · 4 tests/u);
		expect(text).toMatch(/✗ failed\s+failed/u);
		expect(text).toMatch(/○ waiting\s+waiting/u);
	});

	it("doesn't call a package passed unless its check did", () => {
		expect(rows(panel("packages", [finishCheck(check(lines), true, 3000)]))).toMatch(/✓ api\s+passed/u);

		const stopped = rows(panel("packages", [finishCheck(check(lines), false, 3000)]));
		expect(stopped).toMatch(/– api\s+stopped/u);
		expect(stopped).toMatch(/○ waiting\s+not run/u);
	});

	it("highlights the selected row and knows its package", () => {
		const target = panel("packages", [check(lines)], { state: { selected: 1 } });

		expect(target.row(1)).toContain("▸");
		expect(target.packageAt(1)).toBe("@workspace/cached");
		expect(target.row(99)).toBe("");
	});

	it("prefers the check that's running, and explains an empty list", () => {
		const lint = finishCheck(feed("lint", ["@workspace/old:lint: x"]), true, 1);

		expect(panel("packages", [lint, check(lines)]).packageAt(0)).toBe("@workspace/api");
		expect(panel("packages", [feed(undefined, [])]).length).toBe(0);
		expect(panel("packages", [feed(undefined, [])]).row(0)).toBe("");
	});
});

describe("slowest", () => {
	it("puts the slowest first, across checks", () => {
		const text = rows(panel("slowest", [check(["@workspace/api:test:  ✓ src/quick.spec.ts (1 test) 5ms", "@workspace/api:test:  ✓ src/slow.spec.ts (1 test) 2.5s"])]));

		expect(text.indexOf("slow.spec.ts")).toBeLessThan(text.indexOf("quick.spec.ts"));
	});
});

describe("problems", () => {
	it("lists failed tests the moment they print, before the check is over", () => {
		expect(rows(panel("problems", [check(["@workspace/api:test:  FAIL  src/b.spec.ts > one"])]))).toContain("src/b.spec.ts > one");
	});

	it("falls back to the failed file, and adds what the failure printed", () => {
		const failed = finishCheck(check(["@workspace/api:test:  ❯ src/b.spec.ts (2 tests | 1 failed) 5ms"]), false, 3000, ["the error"]);
		const text = rows(panel("problems", [failed]));

		expect(text).toContain("✗ Unit tests");
		expect(text).toContain("src/b.spec.ts");
		expect(text).toContain("the error");
	});

	it("still lists a failed check with no details", () => {
		expect(rows(panel("problems", [finishCheck(check([]), false, 3000)]))).toContain("✗ Unit tests");
	});

	it("says when there are none", () => {
		expect(panel("problems", [check([])]).empty).toBe("No problems so far.");
	});
});

describe("log", () => {
	const log: readonly LogLine[] = [
		{ workspace: "@workspace/api", text: "api line" },
		{ workspace: "@workspace/ui", text: "ui line" },
		{ workspace: undefined, text: "turbo line" },
	];

	it("shows every line with its package", () => {
		expect(panel("log", [], { log }).length).toBe(3);
		expect(rows(panel("log", [], { log }))).toMatch(/api\s+api line/u);
	});

	it("narrows to one package", () => {
		const target = panel("log", [], { log, state: { logFilter: "@workspace/ui" } });

		expect(target.length).toBe(1);
		expect(target.tail).toBe(true);
		expect(target.packageAt(0)).toBeUndefined();
		expect(rows(target)).toContain("ui line");
		expect(target.row(5)).toBe("  ");
	});
});

describe("changes", () => {
	it("lists commits, then files with their lines", () => {
		const changes: ChangeSummary = {
			headline: "",
			commits: [{ hash: "abc1234", subject: "Fix the thing" }],
			files: [
				{ path: "src/a.ts", added: 3, removed: 1 },
				{ path: "logo.png", added: undefined, removed: undefined },
				{ path: "src/b.ts", added: undefined, removed: 2 },
			],
		};
		const text = rows(panel("changes", [], { changes }));

		expect(text).toContain("1 commit");
		expect(text).toContain("abc1234  Fix the thing");
		expect(text).toContain("3 files");
		expect(text).toMatch(/\+3\s+−1\s+src\/a\.ts/u);
		expect(text).toMatch(/binary\s+logo\.png/u);
	});

	it("leaves out a part it doesn't have, and says when git gave nothing", () => {
		const onlyFiles = rows(panel("changes", [], { changes: { ...NO_CHANGES, files: [{ path: "src/a.ts", added: 1, removed: 0 }] } }));

		expect(onlyFiles).not.toContain("commit");
		expect(panel("changes", []).length).toBe(0);
		expect(panel("changes", []).empty).toContain("Git couldn't say");
	});
});

// The rows of each dashboard view. Rows are drawn on demand, so a log of thousands of lines only pays for what is on
// screen.
import { formatDuration } from "../shared/format-duration.ts";
import type { ChangedFile, ChangeSummary } from "./change-summary.ts";
import type { DashboardState, ViewId } from "./dashboard.ts";
import type { CheckProgress, PackageProgress, TestFileLine } from "./progress.ts";
import type { Stage } from "./task-output.ts";
import { fitEnd, fitStart, formatCount, plural, shortPackage, type Tint } from "./text.ts";

/** One line of output, with its package when turbo named one. */
export interface LogLine {
	readonly workspace: string | undefined;
	readonly text: string;
}

export interface PanelData {
	readonly checks: readonly CheckProgress[];
	readonly log: readonly LogLine[];
	readonly changes: ChangeSummary;
}

export interface PanelContext {
	readonly width: number;
	readonly tint: Tint;
	readonly nowMs: number;
	readonly spinner: string;
}

export interface Panel {
	readonly length: number;
	/** Whether it follows its newest row. */
	readonly tail: boolean;
	/** What to show with no rows. */
	readonly empty: string;
	row(index: number): string;
	/** The package a row stands for. */
	packageAt(index: number): string | undefined;
}

const INDENT = "  ";
const PACKAGE_COLUMN = 18;
const COUNT_COLUMN = 10;
const PACKAGE_COUNTS_COLUMN = 26;
const TIME_COLUMN = 8;
const STATE_COLUMN = 9;
const LINES_COLUMN = 8;
/** Below this width the path is the whole row. */
const NARROW_WIDTH = 60;
const MS_PER_SECOND = 1000;

/** A test file's time: most take milliseconds, which `0.0s` would hide. */
function fileTime(durationMs: number | undefined): string {
	if (durationMs === undefined) {
		return "";
	}
	return durationMs < MS_PER_SECOND ? `${String(Math.round(durationMs))}ms` : formatDuration(durationMs);
}

function listPanel(rows: readonly string[], empty: string, tail = false): Panel {
	return { length: rows.length, tail, empty, row: (index) => rows.at(index) ?? "", packageAt: () => undefined };
}

function fileRow(file: TestFileLine, { width, tint }: PanelContext): string {
	const wide = width >= NARROW_WIDTH;
	const counts = wide ? `${(file.tests === undefined ? "" : plural(file.tests, "test")).padStart(COUNT_COLUMN)}${fileTime(file.durationMs).padStart(TIME_COLUMN)}` : "";
	const owner = wide ? shortPackage(file.workspace).padEnd(PACKAGE_COLUMN) : "";
	const room = width - INDENT.length - "✓ ".length - owner.length - counts.length;
	return `${INDENT}${file.passed ? tint.pass("✓") : tint.fail("✗")} ${tint.quiet(owner)}${fitStart(file.file, room).padEnd(Math.max(room, 0))}${tint.quiet(counts)}`;
}

function stageRow(stage: Stage, { width, tint, spinner }: PanelContext): string {
	const room = width - INDENT.length - "✓ ".length;
	const marks: Readonly<Record<Stage["status"], string>> = { running: tint.active(spinner), passed: tint.pass("✓"), failed: tint.fail("✗"), skipped: tint.quiet("↓") };
	return `${INDENT}${marks[stage.status]} ${fitEnd(stage.text, room)}`;
}

function logRow(line: LogLine, showOwner: boolean, { width, tint }: PanelContext): string {
	const owner = showOwner ? shortPackage(line.workspace ?? "").padEnd(PACKAGE_COLUMN) : "";
	return `${INDENT}${tint.quiet(owner)}${fitEnd(line.text, width - INDENT.length - owner.length)}`;
}

function logPanel(lines: readonly LogLine[], showOwner: boolean, empty: string, context: PanelContext): Panel {
	return {
		length: lines.length,
		tail: true,
		empty,
		row: (index) => logRow(lines.at(index) ?? { workspace: undefined, text: "" }, showOwner, context),
		packageAt: () => undefined,
	};
}

/** What's happening now: test files as they finish, lint-staged's steps, or else the raw output. */
function livePanel({ checks, log }: PanelData, context: PanelContext): Panel {
	const current = checks.find((check) => check.status === "running") ?? checks.findLast((check) => check.status !== "waiting");
	if (current !== undefined && current.stages.length > 0) {
		return listPanel(
			current.stages.map((stage) => stageRow(stage, context)),
			"",
			true,
		);
	}
	if (current !== undefined && current.recent.length > 0) {
		const { recent } = current;
		return { length: recent.length, tail: true, empty: "", row: (index) => (recent[index] === undefined ? "" : fileRow(recent[index], context)), packageAt: () => undefined };
	}
	return logPanel(
		log.filter((line) => line.text.trim().length > 0),
		true,
		"Starting…",
		context,
	);
}

function packageState(item: PackageProgress, check: CheckProgress, spinner: string, tint: Tint): { readonly mark: string; readonly text: string } {
	if (item.failed) {
		return { mark: tint.fail("✗"), text: "failed" };
	}
	if (item.cached) {
		return { mark: tint.pass("✓"), text: "cached" };
	}
	if (item.startedAtMs === undefined) {
		return { mark: tint.quiet("○"), text: check.status === "running" ? "waiting" : "not run" };
	}
	if (item.finished || check.status === "passed") {
		return { mark: tint.pass("✓"), text: "passed" };
	}
	return check.status === "running" ? { mark: tint.active(spinner), text: "running" } : { mark: tint.quiet("–"), text: "stopped" };
}

function packageRow(item: PackageProgress, check: CheckProgress, selected: boolean, { width, tint, spinner }: PanelContext): string {
	const { mark, text } = packageState(item, check, spinner, tint);
	const time = item.startedAtMs === undefined || item.cached ? "" : formatDuration((item.lastLineAtMs ?? item.startedAtMs) - item.startedAtMs);
	const counts = item.testFiles === 0 ? "" : `${plural(item.testFiles, "file")} · ${plural(item.tests, "test")}`;
	const nameRoom = width - INDENT.length - "▸ ✓ ".length - STATE_COLUMN - PACKAGE_COUNTS_COLUMN - TIME_COLUMN;
	const name = fitEnd(shortPackage(item.name), nameRoom).padEnd(Math.max(nameRoom, 0));
	return `${INDENT}${selected ? tint.active("▸") : " "} ${mark} ${selected ? tint.title(name) : name}${tint.quiet(`${text.padEnd(STATE_COLUMN)}${counts.padEnd(PACKAGE_COUNTS_COLUMN)}${time.padStart(TIME_COLUMN)}`)}`;
}

function packagesPanel(checks: readonly CheckProgress[], selected: number, context: PanelContext): Panel {
	const check = checks.find((item) => item.status === "running" && item.packages.size > 0) ?? checks.findLast((item) => item.packages.size > 0);
	const items = check === undefined ? [] : [...check.packages.values()];
	return {
		length: items.length,
		tail: false,
		empty: "No packages yet. This check isn't split by package, or it hasn't started.",
		row: (index) => (check === undefined || items[index] === undefined ? "" : packageRow(items[index], check, index === selected, context)),
		packageAt: (index) => items.at(index)?.name,
	};
}

function slowestPanel(checks: readonly CheckProgress[], context: PanelContext): Panel {
	const files = checks.flatMap((check) => check.slowest).toSorted((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0));
	return listPanel(
		files.map((file) => fileRow(file, context)),
		"Nothing timed yet. Test files appear here as they finish.",
	);
}

function problemRows(check: CheckProgress, { width, tint }: PanelContext): readonly string[] {
	const room = width - INDENT.length - "✗ ".length;
	const heading = `${INDENT}${tint.fail("✗")} ${tint.title(check.label)}`;
	const tests = check.failedTests.map((name) => `${INDENT}  ${fitEnd(name, room)}`);
	const files = tests.length > 0 ? [] : check.failedFiles.map((file) => `${INDENT}  ${fitStart(file.file, room)}`);
	const log = check.failureLog.map((line) => tint.quiet(`${INDENT}  ${fitEnd(line, room)}`));
	return [heading, ...tests, ...files, ...(log.length > 0 ? ["", ...log, ""] : [""])];
}

function problemsPanel(checks: readonly CheckProgress[], context: PanelContext): Panel {
	const failing = checks.filter((check) => check.status === "failed" || check.failedTests.length > 0 || check.failedFiles.length > 0);
	return listPanel(
		failing.flatMap((check) => problemRows(check, context)),
		"No problems so far.",
	);
}

function changedFileRow(file: ChangedFile, { width, tint }: PanelContext): string {
	const binary = file.added === undefined && file.removed === undefined;
	const added = tint.pass(`+${formatCount(file.added ?? 0)}`.padStart(LINES_COLUMN));
	const removed = tint.fail(`−${formatCount(file.removed ?? 0)}`.padStart(LINES_COLUMN));
	const lines = binary ? tint.quiet("binary".padStart(LINES_COLUMN + LINES_COLUMN)) : `${added}${removed}`;
	return `${INDENT}${lines}  ${fitStart(file.path, width - INDENT.length - LINES_COLUMN - LINES_COLUMN - INDENT.length)}`;
}

function changesPanel({ commits, files }: ChangeSummary, context: PanelContext): Panel {
	const { width, tint } = context;
	const commitRows = commits.map((commit) => `${INDENT}${tint.active(commit.hash)}  ${fitEnd(commit.subject, width - INDENT.length - commit.hash.length - INDENT.length)}`);
	const rows = [
		...(commitRows.length > 0 ? [`${INDENT}${tint.title(plural(commits.length, "commit"))}`, ...commitRows, ""] : []),
		...(files.length > 0 ? [`${INDENT}${tint.title(plural(files.length, "file"))}`, ...files.map((file) => changedFileRow(file, context))] : []),
	];
	return listPanel(rows, "Git couldn't say what changed. The checks run the same.");
}

/** The rows of the view on screen. */
export function buildPanel({ view, selected, logFilter }: DashboardState, data: PanelData, context: PanelContext): Panel {
	const panels: Readonly<Record<ViewId, () => Panel>> = {
		live: () => livePanel(data, context),
		packages: () => packagesPanel(data.checks, selected, context),
		slowest: () => slowestPanel(data.checks, context),
		problems: () => problemsPanel(data.checks, context),
		log: () => logPanel(logFilter === undefined ? data.log : data.log.filter((line) => line.workspace === logFilter), logFilter === undefined, "No output yet.", context),
		changes: () => changesPanel(data.changes, context),
	};
	return panels[view]();
}

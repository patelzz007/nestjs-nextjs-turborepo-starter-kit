// Draws the hooks' live display as plain lines of text. Pure: `tint` is the only thing that knows about colour, and
// every line is cut to the terminal's width first, because a wrapped line would break the redraw.
import { formatDuration } from "../shared/format-duration.ts";
import type { CheckProgress } from "./progress.ts";

/** Colours the text; the identity when colour is off. */
export interface Tint {
	readonly title: (text: string) => string;
	readonly active: (text: string) => string;
	readonly pass: (text: string) => string;
	readonly fail: (text: string) => string;
	readonly quiet: (text: string) => string;
}

export const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

const INDENT = "  ";
const FILE_INDENT = "      ";
const LABEL_WIDTH = 12;
const TESTS_COLUMN_WIDTH = 10;
const BAR_WIDTH = 12;
const BAR_FILLED = "▰";
const BAR_EMPTY = "▱";
const ELLIPSIS = "…";
/** Below this width the path is the whole row, so the test count is dropped rather than squeezing it. */
const NARROW_WIDTH = 60;
const NUMBER_FORMAT = new Intl.NumberFormat("en-US");

/** Keeps the end of a path, the part that names the file. */
function fitStart(text: string, width: number): string {
	return text.length <= width ? text : `${ELLIPSIS}${text.slice(text.length - width + 1)}`;
}

function fitEnd(text: string, width: number): string {
	return text.length <= width ? text : `${text.slice(0, Math.max(width - 1, 0))}${ELLIPSIS}`;
}

function plural(count: number, noun: string): string {
	return `${NUMBER_FORMAT.format(count)} ${noun}${count === 1 ? "" : "s"}`;
}

function bar(done: number, total: number): string {
	const filled = Math.min(Math.round((done / total) * BAR_WIDTH), BAR_WIDTH);
	return `${BAR_FILLED.repeat(filled)}${BAR_EMPTY.repeat(BAR_WIDTH - filled)}`;
}

function statusMark(check: CheckProgress, frame: number, tint: Tint): string {
	switch (check.status) {
		case "passed":
			return tint.pass("✓");
		case "failed":
			return tint.fail("✗");
		case "running":
			return tint.active(SPINNER_FRAMES.at(frame % SPINNER_FRAMES.length) ?? "");
		case "waiting":
			return tint.quiet("○");
	}
}

/** What sits beside the label: where the check has got to. */
function detail(check: CheckProgress): string {
	if (check.note !== undefined) {
		return check.note;
	}
	if (check.packagesTotal === undefined) {
		return "";
	}
	if (check.status !== "running") {
		return check.status === "waiting" ? "" : plural(check.packagesTotal, "package");
	}
	const seen = Math.min(check.packagesSeen.size, check.packagesTotal);
	return `${bar(seen, check.packagesTotal)} ${String(seen)}/${String(check.packagesTotal)}  ${check.currentWorkspace ?? ""}`;
}

function checkRow(check: CheckProgress, frame: number, nowMs: number, width: number, tint: Tint): string {
	const elapsedMs = check.status === "running" ? nowMs - (check.startedAtMs ?? nowMs) : check.elapsedMs;
	const time = check.status === "waiting" ? "" : formatDuration(elapsedMs);
	const label = check.label.padEnd(LABEL_WIDTH);
	const room = width - INDENT.length - LABEL_WIDTH - time.length - "✓  ".length - 2;
	const painted = check.status === "waiting" ? tint.quiet(label) : label;
	return `${INDENT}${statusMark(check, frame, tint)} ${painted} ${tint.quiet(fitEnd(detail(check), Math.max(room, 0)).padEnd(Math.max(room, 0)))} ${tint.quiet(time)}`;
}

function testFileRows(check: CheckProgress, width: number, tint: Tint): string[] {
	const showCount = width >= NARROW_WIDTH;
	const room = width - FILE_INDENT.length - "✓ ".length - (showCount ? TESTS_COLUMN_WIDTH + 1 : 0);
	const files = check.recent.map((file) => {
		const name = fitStart(file.file, Math.max(room, 0)).padEnd(Math.max(room, 0));
		const count = showCount && file.tests !== undefined ? tint.quiet(` ${plural(file.tests, "test").padStart(TESTS_COLUMN_WIDTH)}`) : "";
		return `${FILE_INDENT}${file.passed ? tint.pass("✓") : tint.fail("✗")} ${name}${count}`;
	});
	const totals = tint.quiet(`${FILE_INDENT}${plural(check.testFiles, "file")} · ${plural(check.tests, "test")} so far`);
	return ["", ...files, "", totals];
}

export interface FrameView {
	readonly title: string;
	readonly subtitle: string;
	readonly checks: readonly CheckProgress[];
	readonly frame: number;
	readonly nowMs: number;
	readonly width: number;
	readonly tint: Tint;
}

/** One frame: the title, a row per check, and the test files of the check that is running them. */
export function renderFrame({ title, subtitle, checks, frame, nowMs, width, tint }: FrameView): string[] {
	const rows = checks.flatMap((check) => {
		const row = checkRow(check, frame, nowMs, width, tint);
		return check.status === "running" && check.testFiles > 0 ? [row, ...testFileRows(check, width, tint)] : [row];
	});
	return ["", `${INDENT}${tint.active("◆")} ${tint.title(title)}`, tint.quiet(`${INDENT}  ${fitEnd(subtitle, Math.max(width - INDENT.length - 2, 0))}`), "", ...rows, ""];
}

/** The closing line of a run that passed. */
export function renderPassed(checks: readonly CheckProgress[], totalMs: number, tint: Tint): string {
	const testFiles = checks.reduce((sum, check) => sum + check.testFiles, 0);
	const tests = checks.reduce((sum, check) => sum + check.tests, 0);
	const counts = testFiles === 0 ? "" : tint.quiet(`  ${plural(testFiles, "test file")} · ${plural(tests, "test")}`);
	return `${INDENT}${tint.pass("✓")} ${tint.title(`All clear in ${formatDuration(totalMs)}`)}${counts}`;
}

/** The closing line of a run that failed. */
export function renderFailed(checks: readonly CheckProgress[], tint: Tint): string {
	const failed = checks.filter((check) => check.status === "failed").map((check) => check.label);
	return `${INDENT}${tint.fail("✗")} ${tint.title(`Stopped: ${failed.join(", ")} failed`)}`;
}

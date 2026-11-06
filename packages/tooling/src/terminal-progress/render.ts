// Draws the hooks' dashboard and closing report as lines of text. Pure, and every line is fitted to the terminal
// before it is coloured, because colour codes have no width.
import { formatDuration } from "../shared/format-duration.ts";
import { VIEWS, type DashboardState, type ViewDefinition } from "./dashboard.ts";
import type { Panel } from "./panels.ts";
import { packagesCached, packagesStarted, problemCount, type CheckProgress } from "./progress.ts";
import type { RunEstimate } from "./run-history.ts";
import { fitEnd, fitStart, formatCount, plural, shortPackage, type Tint } from "./text.ts";

export const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

const INDENT = "  ";
const LABEL_WIDTH = 12;
const BAR_FILLED = "▰";
const BAR_EMPTY = "▱";
const CHECK_BAR_WIDTH = 12;
const PERCENT = 100;
/** Room beside the overall bar for the percentage. */
const PERCENT_WIDTH = 6;
/** Half of the width goes to the overall bar; the counts sit beside it. */
const OVERALL_BAR_SHARE = 0.5;
/** Rows the frame always uses besides the checks and the panel. */
const CHROME_ROWS = 10;
/** Too short a panel shows nothing useful, so a small terminal drops it. */
const MIN_PANEL_ROWS = 3;
/** How many slow files the closing report names. */
const REPORT_SLOWEST = 3;
/** The brackets or spaces around a tab, and the space after it. */
const TAB_PADDING = 3;
/** A smaller difference from the last run is just noise. */
const MS_WORTH_MENTIONING = 5000;

export function spinnerAt(frame: number): string {
	return SPINNER_FRAMES.at(frame % SPINNER_FRAMES.length) ?? "";
}

function bar(fraction: number, width: number): string {
	const filled = Math.min(Math.round(Math.min(Math.max(fraction, 0), 1) * width), width);
	return `${BAR_FILLED.repeat(filled)}${BAR_EMPTY.repeat(width - filled)}`;
}

function statusMark(check: CheckProgress, frame: number, tint: Tint): string {
	switch (check.status) {
		case "passed":
			return tint.pass("✓");
		case "failed":
			return tint.fail("✗");
		case "running":
			return tint.active(spinnerAt(frame));
		case "waiting":
			return tint.quiet("○");
	}
}

/** What a finished check did, in a few words. */
function finishedDetail(check: CheckProgress): string {
	if (check.testFiles > 0) {
		return `${plural(check.testFiles, "file")} · ${plural(check.tests, "test")}`;
	}
	if (check.packagesTotal === undefined) {
		return check.note ?? "";
	}
	const cached = packagesCached(check);
	return cached === 0 ? plural(check.packagesTotal, "package") : `${plural(check.packagesTotal, "package")} · ${formatCount(cached)} cached`;
}

/** What sits beside the label: where the check has got to. */
function detail(check: CheckProgress): string {
	if (check.status === "waiting") {
		return check.note ?? "";
	}
	if (check.status !== "running") {
		return finishedDetail(check);
	}
	if (check.packagesTotal === undefined) {
		return check.note ?? "";
	}
	const seen = Math.min(packagesStarted(check), check.packagesTotal);
	const current = check.currentWorkspace === undefined ? "" : shortPackage(check.currentWorkspace);
	return `${bar(seen / check.packagesTotal, CHECK_BAR_WIDTH)} ${String(seen)}/${String(check.packagesTotal)}  ${current}`;
}

function checkRow(check: CheckProgress, frame: number, nowMs: number, width: number, tint: Tint): string {
	const elapsedMs = check.status === "running" ? nowMs - (check.startedAtMs ?? nowMs) : check.elapsedMs;
	const time = check.status === "waiting" ? "" : formatDuration(elapsedMs);
	const label = check.label.padEnd(LABEL_WIDTH);
	const room = Math.max(width - INDENT.length - LABEL_WIDTH - time.length - "✓  ".length - 1, 0);
	const painted = check.status === "waiting" ? tint.quiet(label) : label;
	return `${INDENT}${statusMark(check, frame, tint)} ${painted} ${tint.quiet(fitEnd(detail(check), room).padEnd(room))} ${tint.quiet(time)}`;
}

function timeLeft({ remainingMs }: RunEstimate): string {
	if (remainingMs === undefined) {
		return "no estimate on a first run";
	}
	return remainingMs === 0 ? "taking longer than last time" : `about ${formatDuration(remainingMs)} left`;
}

function titleRow(title: string, frameText: string, estimate: RunEstimate, elapsedMs: number, width: number, tint: Tint): string {
	const right = `${formatDuration(elapsedMs)} · ${timeLeft(estimate)}`;
	const room = Math.max(width - INDENT.length - "◆ ".length - right.length - frameText.length - 2, 0);
	return `${INDENT}${tint.active("◆")} ${tint.title(fitEnd(title, room).padEnd(room))} ${tint.active(frameText)} ${tint.quiet(right)}`;
}

function totalsText(checks: readonly CheckProgress[]): string {
	const files = checks.reduce((sum, check) => sum + check.testFiles, 0);
	const tests = checks.reduce((sum, check) => sum + check.tests, 0);
	return files === 0 ? "" : `${plural(files, "file")} · ${plural(tests, "test")}`;
}

function overallRow(checks: readonly CheckProgress[], { fraction }: RunEstimate, width: number, tint: Tint): string {
	const barWidth = Math.max(Math.floor((width - INDENT.length) * OVERALL_BAR_SHARE), 0);
	const percent = `${String(Math.floor(Math.min(Math.max(fraction, 0), 1) * PERCENT))}%`.padStart(PERCENT_WIDTH);
	const problems = problemCount(checks);
	const totals = fitEnd(totalsText(checks), width - INDENT.length - barWidth - PERCENT_WIDTH - INDENT.length);
	const failed = problems === 0 ? "" : tint.fail(` · ${plural(problems, "problem")}`);
	return `${INDENT}${tint.active(bar(fraction, barWidth))}${tint.title(percent)}${INDENT}${tint.quiet(totals)}${failed}`;
}

function tabLabel({ id, label }: ViewDefinition, position: number, problems: number): string {
	const number = String(position + 1);
	return id === "problems" && problems > 0 ? `${number} ${label} ${formatCount(problems)}` : `${number} ${label}`;
}

function tabsRow(state: DashboardState, problems: number, width: number, tint: Tint): string {
	const fullLength = VIEWS.map((view, position) => tabLabel(view, position, problems).length + TAB_PADDING).reduce((sum, length) => sum + length, INDENT.length);
	const tabs = VIEWS.map((view, position) => {
		const label = tabLabel(view, position, problems);
		if (view.id === state.view) {
			return tint.active(`[${label}]`);
		}
		// A narrow terminal keeps every tab reachable: the numbers are what the keys are anyway.
		const shown = fullLength > width ? String(position + 1) : label;
		return view.id === "problems" && problems > 0 ? tint.fail(` ${shown} `) : tint.quiet(` ${shown} `);
	});
	return `${INDENT}${tabs.join(" ")}`;
}

function panelTop(state: DashboardState, panel: Panel, height: number): number {
	const lastTop = Math.max(panel.length - height, 0);
	if (state.view === "packages") {
		return Math.min(Math.max(state.selected - height + 1, 0), lastTop);
	}
	return Math.min(state.top ?? (panel.tail ? lastTop : 0), lastTop);
}

function panelRows(state: DashboardState, panel: Panel, height: number, tint: Tint): readonly string[] {
	if (panel.length === 0) {
		return [tint.quiet(`${INDENT}${panel.empty}`), ...Array.from({ length: height - 1 }, () => "")];
	}
	const top = panelTop(state, panel, height);
	return Array.from({ length: height }, (_, offset) => (top + offset < panel.length ? panel.row(top + offset) : ""));
}

export interface HintView {
	readonly state: DashboardState;
	readonly keysEnabled: boolean;
	readonly stopping: boolean;
	/** What a cancel would stop: "push", "commit". */
	readonly action: string;
}

function hintRow({ state, keysEnabled, stopping, action }: HintView, width: number, tint: Tint): string {
	if (stopping) {
		return tint.warn(`${INDENT}Stopping the checks…`);
	}
	if (!keysEnabled) {
		return tint.quiet(`${INDENT}Ctrl+C to cancel the ${action}`);
	}
	if (state.confirmingCancel) {
		return tint.warn(`${INDENT}Cancel the ${action}? Press q again to stop, any other key to keep going`);
	}
	const moves = state.view === "packages" ? "↑↓ select · enter its log" : "↑↓ scroll · G newest";
	const back = state.logFilter === undefined ? "" : ` · esc all packages`;
	return tint.quiet(fitEnd(`${INDENT}←→ or 1-${String(VIEWS.length)} views · ${moves}${back} · q cancel`, width));
}

/** The line above the panel, which says when the log is narrowed to one package. */
function ruleRow(state: DashboardState, width: number, tint: Tint): string {
	const label = state.logFilter === undefined ? "" : ` ${shortPackage(state.logFilter)} only `;
	const rule = `${INDENT}${"─".repeat(INDENT.length)}${label}`;
	return tint.quiet(`${rule}${"─".repeat(Math.max(width - rule.length, 0))}`);
}

export interface FrameView extends HintView {
	readonly title: string;
	readonly headline: string;
	readonly checks: readonly CheckProgress[];
	readonly panel: Panel;
	readonly estimate: RunEstimate;
	readonly frame: number;
	readonly elapsedMs: number;
	readonly nowMs: number;
	readonly width: number;
	readonly height: number;
	readonly tint: Tint;
}

/** How many rows the panel gets in a terminal this tall. */
export function panelHeight(height: number, checks: number): number {
	const rows = height - CHROME_ROWS - checks;
	return rows < MIN_PANEL_ROWS ? 0 : rows;
}

/** One frame, never taller than the terminal: a row past the bottom would scroll it and break the redraw. */
export function renderFrame(view: FrameView): string[] {
	const { title, headline, checks, panel, estimate, frame, elapsedMs, nowMs, width, height, tint, state } = view;
	const spinner = checks.some((check) => check.status === "running") ? spinnerAt(frame) : " ";
	const top = [titleRow(title, spinner, estimate, elapsedMs, width, tint), tint.quiet(`${INDENT}  ${fitEnd(headline, width - INDENT.length - INDENT.length)}`)];
	const rows = checks.map((check) => checkRow(check, frame, nowMs, width, tint));
	const bodyHeight = panelHeight(height, checks.length);
	const overall = overallRow(checks, estimate, width, tint);
	if (bodyHeight === 0) {
		return [...top, overall, ...rows, hintRow(view, width, tint)].slice(-height);
	}
	return [
		"",
		...top,
		"",
		overall,
		"",
		...rows,
		"",
		tabsRow(state, problemCount(checks), width, tint),
		ruleRow(state, width, tint),
		...panelRows(state, panel, bodyHeight, tint),
		hintRow(view, width, tint),
	];
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

/** The closing line of a run someone cancelled. */
export function renderCancelled(totalMs: number, note: string, tint: Tint): string {
	return `${INDENT}${tint.warn("■")} ${tint.title(`Cancelled after ${formatDuration(totalMs)}`)}  ${tint.quiet(note)}`;
}

/** How this run compares with the last one, when the difference is worth saying. */
function comparedWithLast(totalMs: number, previousMs: number | undefined): string {
	if (previousMs === undefined || Math.abs(totalMs - previousMs) < MS_WORTH_MENTIONING) {
		return "";
	}
	return `${formatDuration(Math.abs(totalMs - previousMs))} ${totalMs < previousMs ? "faster" : "slower"} than last time`;
}

export interface SummaryView {
	readonly headline: string;
	readonly checks: readonly CheckProgress[];
	readonly width: number;
	readonly tint: Tint;
	readonly totalMs: number;
	readonly previousMs: number | undefined;
}

/** What stays in the scrollback once the dashboard is gone: the run, check by check, and where the time went. */
export function renderSummary({ headline, checks, width, tint, totalMs, previousMs }: SummaryView): string[] {
	const room = width - INDENT.length - INDENT.length;
	const slowest = checks
		.flatMap((check) => check.slowest)
		.toSorted((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0))
		.slice(0, REPORT_SLOWEST);
	const compared = comparedWithLast(totalMs, previousMs);
	return [
		"",
		tint.quiet(`${INDENT}${fitEnd(headline, room + INDENT.length)}`),
		"",
		...checks.map((check) => checkRow(check, 0, check.startedAtMs ?? 0, width, tint)),
		...(slowest.length > 0
			? [
					"",
					tint.quiet(`${INDENT}Slowest`),
					...slowest.map((file) =>
						tint.quiet(
							`${INDENT}  ${formatDuration(file.durationMs ?? 0).padStart(LABEL_WIDTH / 2)}  ${fitStart(`${shortPackage(file.workspace)} ${file.file}`, room - LABEL_WIDTH)}`,
						),
					),
				]
			: []),
		...(compared === "" ? [] : ["", tint.quiet(`${INDENT}${compared}`)]),
		"",
	];
}

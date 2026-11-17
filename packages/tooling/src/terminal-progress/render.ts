// Draws the hooks' dashboard and closing report as lines of text. Pure, and every line is fitted to the terminal
// before it is coloured, because colour codes have no width.
import { formatDuration } from "../shared/format-duration.ts";
import { selectsRows, VIEWS, type DashboardState, type ViewDefinition } from "./dashboard.ts";
import { fileTime, packageColumn, type Panel } from "./panels.ts";
import { packagesCached, packagesStarted, problemCount, type CheckProgress } from "./progress.ts";
import type { RunEstimate } from "./run-history.ts";
import { fitEnd, fitStart, formatCount, padVisible, plural, shortPackage, type Tint } from "./text.ts";

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
/** Rows the frame always uses besides the checks and the panel, the gap above the key bar included. */
const CHROME_ROWS = 11;
/** Too short a panel shows nothing useful, so a small terminal drops it. */
const MIN_PANEL_ROWS = 3;
/** How many slow files the closing report names. */
const REPORT_SLOWEST = 3;
/** The brackets or spaces around a tab, and the space after it. */
const TAB_PADDING = 3;
/** The panel's right edge: a space, then the scrollbar. */
const SCROLLBAR_WIDTH = 2;
const SCROLL_TRACK = "│";
const SCROLL_THUMB = "┃";
/** Between one key and the next on the key bar. */
const KEY_GAP = "   ";
/** Activity, quietest to busiest. */
const SPARK_LEVELS = "▁▂▃▄▅▆▇█";
const LOWEST_SPARK = "▁";
/** The rate beside the sparkline is the mean of this many of its latest seconds, so it doesn't flicker. */
const RATE_SECONDS = 5;
/** The closing card's two sides and the space inside each. */
const CARD_EDGES = 4;

export function spinnerAt(frame: number): string {
	return SPINNER_FRAMES.at(frame % SPINNER_FRAMES.length) ?? "";
}

/** How wide a panel's rows may be in a terminal this wide: the scrollbar takes the rest. */
export function panelWidth(width: number): number {
	return Math.max(width - SCROLLBAR_WIDTH, 0);
}

function bar(fraction: number, width: number): string {
	const filled = Math.min(Math.round(Math.min(Math.max(fraction, 0), 1) * width), width);
	return `${BAR_FILLED.repeat(filled)}${BAR_EMPTY.repeat(width - filled)}`;
}

/** One character per value, each as tall as the value is against the largest. */
export function sparkline(values: readonly number[]): string {
	const peak = values.reduce((highest, value) => Math.max(highest, value), 0);
	const top = SPARK_LEVELS.length - 1;
	return values.map((value) => (peak === 0 ? LOWEST_SPARK : (SPARK_LEVELS.at(Math.round((Math.max(value, 0) / peak) * top)) ?? LOWEST_SPARK))).join("");
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

/** Test files a second, as a sparkline and a rate; nothing until a file has finished. */
function throughputText(throughput: readonly number[]): string {
	if (!throughput.some((count) => count > 0)) {
		return "";
	}
	const latest = throughput.slice(-RATE_SECONDS);
	const rate = Math.round(latest.reduce((sum, count) => sum + count, 0) / latest.length);
	return `${sparkline(throughput)} ${formatCount(rate)}/s`;
}

function overallRow(checks: readonly CheckProgress[], { fraction }: RunEstimate, throughput: readonly number[], width: number, tint: Tint): string {
	const barWidth = Math.max(Math.floor((width - INDENT.length) * OVERALL_BAR_SHARE), 0);
	const percent = `${String(Math.floor(Math.min(Math.max(fraction, 0), 1) * PERCENT))}%`.padStart(PERCENT_WIDTH);
	const problems = problemCount(checks);
	const failed = problems === 0 ? "" : ` · ${plural(problems, "problem")}`;
	const room = width - INDENT.length - barWidth - PERCENT_WIDTH - INDENT.length;
	const totals = fitEnd(totalsText(checks), room - failed.length);
	const activity = throughputText(throughput);
	const activityRoom = room - totals.length - failed.length - INDENT.length;
	const shownActivity = activity.length > 0 && activity.length <= activityRoom ? `${INDENT}${tint.active(activity)}` : "";
	return `${INDENT}${tint.active(bar(fraction, barWidth))}${tint.title(percent)}${INDENT}${tint.quiet(totals)}${tint.fail(failed)}${shownActivity}`;
}

function tabLabel({ id, label }: ViewDefinition, position: number, problems: number): string {
	const number = String(position + 1);
	return id === "problems" && problems > 0 ? `${number} ${label} ${formatCount(problems)}` : `${number} ${label}`;
}

function tabsRow(state: DashboardState, problems: number, width: number, tint: Tint): string {
	const fullLength = VIEWS.map((view, position) => tabLabel(view, position, problems).length + TAB_PADDING).reduce((sum, length) => sum + length, INDENT.length);
	const tabs = VIEWS.map((view, position) => {
		const label = tabLabel(view, position, problems);
		if (view.id === state.view && !state.help) {
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
	if (selectsRows(state)) {
		return Math.min(Math.max(state.selected - height + 1, 0), lastTop);
	}
	return Math.min(state.top ?? (panel.tail ? lastTop : 0), lastTop);
}

/** The scrollbar's character on each panel row: blank when everything fits. */
function scrollbar(state: DashboardState, panel: Panel, height: number, tint: Tint): readonly string[] {
	if (panel.length <= height) {
		return Array.from({ length: height }, () => " ");
	}
	const thumb = Math.max(Math.round((height * height) / panel.length), 1);
	const lastTop = panel.length - height;
	const thumbTop = Math.round((panelTop(state, panel, height) / lastTop) * (height - thumb));
	return Array.from({ length: height }, (_, row) => (row >= thumbTop && row < thumbTop + thumb ? tint.active(SCROLL_THUMB) : tint.quiet(SCROLL_TRACK)));
}

function panelRows(state: DashboardState, panel: Panel, height: number, width: number, tint: Tint): readonly string[] {
	if (panel.length === 0) {
		return [tint.quiet(`${INDENT}${panel.empty}`), ...Array.from({ length: height - 1 }, () => "")];
	}
	const top = panelTop(state, panel, height);
	const rowWidth = panelWidth(width);
	const bars = scrollbar(state, panel, height, tint);
	return Array.from({ length: height }, (_, offset) => {
		const row = top + offset < panel.length ? panel.row(top + offset) : "";
		return `${padVisible(row, rowWidth)} ${bars.at(offset) ?? " "}`;
	});
}

export interface HintView {
	readonly state: DashboardState;
	readonly keysEnabled: boolean;
	readonly stopping: boolean;
	/** What a cancel would stop: "push", "commit". */
	readonly action: string;
}

interface KeyHint {
	readonly key: string;
	readonly does: string;
}

/** Always on the key bar, last: the one key that matters when something is wrong. */
const CANCEL_HINT: KeyHint = { key: "q", does: "cancel" };

/** The keys worth showing for what is on screen, before cancel; as many as fit are shown. */
function keyHints(state: DashboardState): readonly KeyHint[] {
	if (state.help) {
		return [
			{ key: "?", does: "close" },
			{ key: "esc", does: "close" },
		];
	}
	const moves: readonly KeyHint[] = selectsRows(state)
		? [
				{ key: "↑↓", does: "select" },
				{ key: "enter", does: "its log" },
			]
		: [
				{ key: "↑↓", does: "scroll" },
				{ key: "G", does: "newest" },
			];
	return [{ key: "←→", does: "views" }, ...moves, ...(state.logFilter === undefined ? [] : [{ key: "esc", does: "all packages" }]), { key: "?", does: "keys" }];
}

function hintText({ key, does }: KeyHint): string {
	return `${key} ${does}`;
}

/** The key bar: each key bright, what it does dim. Cancel always shows; the others while they fit before it. */
function keyBar(hints: readonly KeyHint[], width: number, tint: Tint): string {
	const room = width - INDENT.length - hintText(CANCEL_HINT).length - KEY_GAP.length;
	const leading = hints.reduce<readonly KeyHint[]>((shown, hint) => ([...shown, hint].map(hintText).join(KEY_GAP).length <= room ? [...shown, hint] : shown), []);
	return `${INDENT}${[...leading, CANCEL_HINT].map(({ key, does }) => `${tint.active(key)} ${tint.quiet(does)}`).join(KEY_GAP)}`;
}

function hintRow({ state, keysEnabled, stopping, action }: HintView, width: number, tint: Tint): string {
	if (stopping) {
		return tint.warn(`${INDENT}Stopping the checks…`);
	}
	if (!keysEnabled) {
		return tint.quiet(`${INDENT}Ctrl+C to cancel the ${action}`);
	}
	if (state.confirmingCancel) {
		return tint.warn(fitEnd(`${INDENT}Cancel the ${action}? Press q again to stop, any other key to keep going`, width));
	}
	return keyBar(keyHints(state), width, tint);
}

/** Where the panel is scrolled to, and whether it has stopped following the newest row. */
function positionText(state: DashboardState, panel: Panel, height: number): string {
	if (panel.length <= height) {
		return "";
	}
	const top = panelTop(state, panel, height);
	const where = `${formatCount(top + 1)}–${formatCount(Math.min(top + height, panel.length))} of ${formatCount(panel.length)}`;
	const paused = panel.tail && !selectsRows(state) && state.top !== undefined;
	return paused ? `paused · G follows · ${where}` : where;
}

/** The line above the panel: what it is narrowed to on the left, where it is scrolled to on the right. */
function ruleRow(state: DashboardState, panel: Panel, height: number, width: number, tint: Tint): string {
	const label = state.help ? " keys " : state.logFilter === undefined ? "" : ` ${shortPackage(state.logFilter)} only `;
	const position = positionText(state, panel, height);
	const right = position === "" ? "" : ` ${position} `;
	const left = `${INDENT}${"─".repeat(INDENT.length)}${label}`;
	const fill = "─".repeat(Math.max(width - left.length - right.length - INDENT.length, 0));
	const paused = position.startsWith("paused");
	return `${tint.quiet(`${left}${fill}`)}${paused ? tint.warn(right) : tint.quiet(right)}${tint.quiet("─".repeat(INDENT.length))}`;
}

export interface FrameView extends HintView {
	readonly title: string;
	readonly headline: string;
	readonly checks: readonly CheckProgress[];
	readonly panel: Panel;
	readonly estimate: RunEstimate;
	/** Test files finished in each of the latest seconds, oldest first. */
	readonly throughput: readonly number[];
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
	const { title, headline, checks, panel, estimate, throughput, frame, elapsedMs, nowMs, width, height, tint, state } = view;
	const spinner = checks.some((check) => check.status === "running") ? spinnerAt(frame) : " ";
	const top = [titleRow(title, spinner, estimate, elapsedMs, width, tint), tint.quiet(`${INDENT}  ${fitEnd(headline, width - INDENT.length - INDENT.length)}`)];
	const rows = checks.map((check) => checkRow(check, frame, nowMs, width, tint));
	const bodyHeight = panelHeight(height, checks.length);
	const overall = overallRow(checks, estimate, throughput, width, tint);
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
		ruleRow(state, panel, bodyHeight, width, tint),
		...panelRows(state, panel, bodyHeight, width, tint),
		"",
		hintRow(view, width, tint),
	];
}

/** The text the terminal's tab shows while the checks run, so the progress is in sight from another tab. */
export function windowTitle(title: string, checks: readonly CheckProgress[], { fraction }: RunEstimate): string {
	const problems = problemCount(checks);
	const percent = `${String(Math.floor(Math.min(Math.max(fraction, 0), 1) * PERCENT))}%`;
	return problems === 0 ? `${percent} · ${title}` : `✗ ${plural(problems, "problem")} · ${percent} · ${title}`;
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

/** How to run again just the packages that failed, each the way the hook ran it (turbo, so its dependencies build first). */
export function renderRerun(checks: readonly CheckProgress[], tint: Tint): string[] {
	const commands = checks.flatMap(({ task, packages }) =>
		task === undefined ? [] : [...packages.values()].filter((item) => item.failed).map((item) => `pnpm turbo run ${task} --filter=${item.name}`),
	);
	return commands.length === 0 ? [] : [tint.quiet(`${INDENT}Rerun just what failed:`), ...commands.map((command) => `${INDENT}  ${tint.active("$")} ${command}`)];
}

/** The closing line of a run someone cancelled. */
export function renderCancelled(totalMs: number, note: string, tint: Tint): string {
	return `${INDENT}${tint.warn("■")} ${tint.title(`Cancelled after ${formatDuration(totalMs)}`)}  ${tint.quiet(note)}`;
}

export interface SummaryView {
	readonly headline: string;
	readonly checks: readonly CheckProgress[];
	readonly width: number;
	readonly tint: Tint;
	/** What this run did against the ones before it (run-history.ts → runRecords). */
	readonly records: readonly string[];
}

/** Rows inside a box drawn with rounded corners, each padded to the same width. */
function card(rows: readonly string[], width: number, tint: Tint): string[] {
	const inner = Math.max(width - INDENT.length - CARD_EDGES, 0);
	const edge = "─".repeat(inner + INDENT.length);
	return [
		tint.quiet(`${INDENT}╭${edge}╮`),
		...rows.map((row) => `${INDENT}${tint.quiet("│")} ${padVisible(row, inner)} ${tint.quiet("│")}`),
		tint.quiet(`${INDENT}╰${edge}╯`),
	];
}

/** What stays in the scrollback once the dashboard is gone: the run, check by check, where the time went, and any record. */
export function renderSummary({ headline, checks, width, tint, records }: SummaryView): string[] {
	const inner = Math.max(width - INDENT.length - CARD_EDGES, 0);
	const slowest = checks
		.flatMap((check) => check.slowest)
		.toSorted((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0))
		.slice(0, REPORT_SLOWEST);
	const timeWidth = LABEL_WIDTH / 2;
	const column = packageColumn(slowest.map((file) => file.workspace));
	const pathRoom = inner - timeWidth - INDENT.length - column - INDENT.length;
	const rows = [
		tint.title(fitEnd(headline, inner)),
		"",
		// A check row starts with its own indent, which the card's padding replaces.
		...checks.map((check) => checkRow(check, 0, check.startedAtMs ?? 0, inner + INDENT.length, tint).slice(INDENT.length)),
		...(slowest.length > 0
			? [
					"",
					tint.quiet("Slowest"),
					...slowest.map(
						(file) =>
							`${tint.quiet(fileTime(file.durationMs).padStart(timeWidth))}${INDENT}${tint.quiet(fitEnd(shortPackage(file.workspace), column).padEnd(column))}${INDENT}${fitStart(file.file, pathRoom)}`,
					),
				]
			: []),
		...(records.length > 0 ? ["", ...records.map((record) => tint.active(fitEnd(record, inner)))] : []),
	];
	return ["", ...card(rows, width, tint), ""];
}

// Runs a git hook's checks one after the other and shows them working. In a terminal that is a live dashboard you can
// look around in; anywhere else (a GUI git client, CI) one plain line per check, so a log stays readable. The exit
// codes decide the result. Nothing read from the output can make a check pass, and nothing on the dashboard can
// either: its only power over the run is to cancel it, which fails the hook.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { stripVTControlCharacters, styleText } from "node:util";

import { formatDuration } from "../shared/format-duration.ts";
import type { ChangeSummary } from "./change-summary.ts";
import { startCommand, type RunningCommand } from "./command.ts";
import { openKeyboard, type KeyboardOpener } from "./keyboard.ts";
import { LiveDashboard } from "./live-dashboard.ts";
import type { LogLine, PanelData } from "./panels.ts";
import { applyLine, finishCheck, startCheck, waitingCheck, type CheckProgress } from "./progress.ts";
import { renderCancelled, renderFailed, renderPassed, renderSummary } from "./render.ts";
import { readRunHistory, writeRunHistory } from "./run-history.ts";
import type { ProgressStream } from "./screen.ts";
import { parseFailedTasks, parseTaskLine } from "./task-output.ts";
import type { Tint } from "./text.ts";

export interface LiveCheck {
	readonly id: string;
	readonly label: string;
	readonly task?: string;
	readonly note?: string;
	readonly command: string;
	readonly args: readonly string[];
	readonly env?: Record<string, string | undefined>;
}

export interface RunChecksOptions {
	readonly title: string;
	/** What is being checked, for the header and the Changes view. */
	readonly changes: ChangeSummary;
	/** What a cancel stops: "push", "commit". */
	readonly action: string;
	readonly checks: readonly LiveCheck[];
	readonly cwd: string;
	readonly stream: ProgressStream;
	/** Where the whole output is kept, for a failure worth reading in full. */
	readonly logFile: string;
	/** Where the last good run's timings are kept, for the time-left estimate. */
	readonly historyFile: string;
	/** Printed after a pass, when what comes next is another wait. */
	readonly nextStep?: string;
	readonly openKeys?: KeyboardOpener;
}

const DEFAULT_WIDTH = 80;
/** The report sits in the scrollback, where a very wide table is hard to read. */
const REPORT_MAX_WIDTH = 100;
/** The most of a failed task's log printed here; the log file has the rest. */
const FAILURE_LOG_LINES = 80;
/** lint-staged echoes its whole command, thousands of paths long, right above the error that matters. */
const FAILURE_LINE_LENGTH = 300;
/** Lines the Log view keeps to scroll through; the log file has them all. */
const LOG_VIEW_LINES = 20_000;
const TAB = /\t/gu;
const TAB_SPACES = "  ";
const STOP_SIGNALS: readonly NodeJS.Signals[] = ["SIGINT", "SIGTERM", "SIGHUP"];

const PLAIN_TINT: Tint = { title: String, active: String, pass: String, fail: String, warn: String, quiet: String };
const COLOUR_TINT: Tint = {
	title: (text) => styleText("bold", text, { validateStream: false }),
	active: (text) => styleText("cyan", text, { validateStream: false }),
	pass: (text) => styleText("green", text, { validateStream: false }),
	fail: (text) => styleText("red", text, { validateStream: false }),
	warn: (text) => styleText("yellow", text, { validateStream: false }),
	quiet: (text) => styleText("gray", text, { validateStream: false }),
};

/** The stream a person is looking at: git hands some hooks a redirected stdout. */
export function terminalStream(): ProgressStream {
	return process.stdout.isTTY ? process.stdout : process.stderr.isTTY ? process.stderr : process.stdout;
}

/** What to print for a failure: the logs of the tasks turbo named, else everything the check printed. */
export function failureLog(lines: readonly string[]): string[] {
	const failed = new Set(lines.flatMap((line) => parseFailedTasks(line)));
	const named = lines.filter((line) => {
		const task = parseTaskLine(line);
		return task !== undefined && failed.has(`${task.workspace}#${task.task}`);
	});
	return (named.length > 0 ? named : lines).slice(-FAILURE_LOG_LINES).map((line) => (line.length <= FAILURE_LINE_LENGTH ? line : `${line.slice(0, FAILURE_LINE_LENGTH)}…`));
}

/** A line of output as the Log view shows it: its package apart, and nothing that could move the cursor. */
export function toLogLine(rawLine: string): LogLine {
	const task = parseTaskLine(rawLine);
	const text = task === undefined ? stripVTControlCharacters(rawLine) : task.text;
	return { workspace: task?.workspace, text: stripVTControlCharacters(text).replace(TAB, TAB_SPACES) };
}

function writeLog(logFile: string, lines: readonly string[]): void {
	mkdirSync(path.dirname(logFile), { recursive: true });
	writeFileSync(logFile, `${lines.join("\n")}\n`);
}

/** Runs every check, as `ci:local --only` does, so one push shows every problem. True when they all pass. */
export async function runChecks(options: RunChecksOptions): Promise<boolean> {
	const { title, changes, action, checks, cwd, stream, logFile, historyFile, nextStep, openKeys = openKeyboard } = options;
	const live = stream.isTTY === true;
	const tint = live && stream.hasColors?.() === true ? COLOUR_TINT : PLAIN_TINT;
	const startedAtMs = Date.now();
	const history = readRunHistory(historyFile);
	let progress: readonly CheckProgress[] = checks.map((check) => waitingCheck(check.id, check.label, check.task, check.note));
	let log: readonly LogLine[] = [];
	let running: RunningCommand | undefined;
	let cancelled = false;
	const isCancelled = (): boolean => cancelled;
	const allLines: string[] = [];
	const failures: string[] = [];

	const replace = (id: string, change: (check: CheckProgress) => CheckProgress): void => {
		progress = progress.map((check) => (check.id === id ? change(check) : check));
	};
	// A second cancel doesn't wait for anything to stop politely.
	const cancel = (): void => {
		if (cancelled) {
			running?.kill();
			return;
		}
		cancelled = true;
		running?.interrupt();
	};
	const dashboard = live
		? new LiveDashboard({
				title,
				action,
				stream,
				tint,
				history,
				startedAtMs,
				data: (): PanelData => ({ checks: progress, log, changes }),
				isStopping: isCancelled,
				onCancel: cancel,
				openKeys,
			})
		: undefined;

	STOP_SIGNALS.forEach((signal) => process.on(signal, cancel));
	if (dashboard === undefined) {
		stream.write(`${title}: ${changes.headline}\n`);
	}
	dashboard?.start();

	for (const check of checks) {
		if (isCancelled()) {
			break;
		}
		replace(check.id, (current) => startCheck(current, Date.now()));
		const checkLines: string[] = [];
		running = startCommand({ command: check.command, args: check.args, cwd, env: { ...process.env, ...check.env } }, (line) => {
			checkLines.push(line);
			allLines.push(line);
			log = [...log.slice(-(LOG_VIEW_LINES - 1)), toLogLine(line)];
			replace(check.id, (current) => applyLine(current, line, Date.now()));
		});
		const exitCode = await running.exit;
		running = undefined;
		const failed = exitCode === 0 ? [] : failureLog(checkLines);
		replace(check.id, (current) => finishCheck(current, exitCode === 0, Date.now(), failed));
		if (!isCancelled()) {
			failures.push(...failed);
		}
		if (dashboard === undefined) {
			const finished = progress.find((current) => current.id === check.id);
			stream.write(`${exitCode === 0 ? "✓" : "✗"} ${check.label} (${formatDuration(finished?.elapsedMs ?? 0)})\n`);
		}
	}

	dashboard?.stop();
	STOP_SIGNALS.forEach((signal) => process.off(signal, cancel));
	writeLog(logFile, allLines);
	const totalMs = Date.now() - startedAtMs;
	const finishedCleanly = !isCancelled() && progress.every((check) => check.status === "passed");
	if (live) {
		const width = Math.min(stream.columns ?? DEFAULT_WIDTH, REPORT_MAX_WIDTH);
		// A run cut short says nothing about speed.
		const previousMs = finishedCleanly ? history?.totalMs : undefined;
		stream.write(`${renderSummary({ headline: changes.headline, checks: progress, width, tint, totalMs, previousMs }).join("\n")}\n`);
	}

	if (isCancelled()) {
		stream.write(`${renderCancelled(totalMs, `The ${action} did not happen.`, tint)}\n\n`);
		return false;
	}
	// The exit codes, not the log: a check can fail without printing a word.
	if (!finishedCleanly) {
		stream.write(`${failures.map((line) => `${line}\n`).join("")}\n${renderFailed(progress, tint)}\n  ${tint.quiet(`Full log: ${path.relative(cwd, logFile)}`)}\n\n`);
		return false;
	}
	writeRunHistory(historyFile, progress, totalMs);
	stream.write(`${renderPassed(progress, totalMs, tint)}\n`);
	if (nextStep !== undefined) {
		stream.write(`  ${tint.active("→")} ${nextStep}\n`);
	}
	stream.write("\n");
	return true;
}

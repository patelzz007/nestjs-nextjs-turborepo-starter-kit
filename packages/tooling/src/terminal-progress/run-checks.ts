// Runs a git hook's checks one after the other and shows them working. In a terminal that is a live, redrawn
// display; anywhere else (a GUI git client, CI) one plain line per check, so a log stays readable. The exit codes
// decide the result. Nothing read from the output can make a check pass.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
import { styleText } from "node:util";

import { formatDuration } from "../shared/format-duration.ts";
import { LiveRegion, type ProgressStream } from "./live-region.ts";
import { applyLine, finishCheck, startCheck, waitingCheck, type CheckProgress } from "./progress.ts";
import { renderFailed, renderFrame, renderPassed, type Tint } from "./render.ts";
import { parseFailedTasks, parseTaskLine } from "./task-output.ts";

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
	readonly subtitle: string;
	readonly checks: readonly LiveCheck[];
	readonly cwd: string;
	readonly stream: ProgressStream;
	/** Where the whole output is kept, for a failure worth reading in full. */
	readonly logFile: string;
	/** Printed after a pass, when what comes next is another wait. */
	readonly nextStep?: string;
}

const FRAME_INTERVAL_MS = 80;
const DEFAULT_WIDTH = 80;
/** Past this a wide terminal only adds empty space between the columns. */
const MAX_WIDTH = 100;
/** The most of a failed task's log printed here; the log file has the rest. */
const FAILURE_LOG_LINES = 80;
/** lint-staged echoes its whole command, thousands of paths long, right above the error that matters. */
const FAILURE_LINE_LENGTH = 300;
const NO_EXIT_CODE = 1;

const PLAIN_TINT: Tint = { title: String, active: String, pass: String, fail: String, quiet: String };
const COLOUR_TINT: Tint = {
	title: (text) => styleText("bold", text, { validateStream: false }),
	active: (text) => styleText("cyan", text, { validateStream: false }),
	pass: (text) => styleText("green", text, { validateStream: false }),
	fail: (text) => styleText("red", text, { validateStream: false }),
	quiet: (text) => styleText("gray", text, { validateStream: false }),
};

/** The stream a person is looking at: git hands some hooks a redirected stdout. */
export function terminalStream(): ProgressStream {
	return process.stdout.isTTY ? process.stdout : process.stderr.isTTY ? process.stderr : process.stdout;
}

/** Runs one command, handing over each line of its output; resolves to its exit code. */
function runCommand(check: LiveCheck, cwd: string, env: NodeJS.ProcessEnv, onLine: (line: string) => void): Promise<number> {
	return new Promise((resolve) => {
		// Through `sh` (argv passed verbatim): package-manager shims can be scripts execve() rejects (ENOEXEC).
		const child = spawn("sh", ["-c", 'exec "$0" "$@"', check.command, ...check.args], { cwd, env: { ...env, ...check.env }, stdio: ["ignore", "pipe", "pipe"] });
		createInterface({ input: child.stdout }).on("line", onLine);
		createInterface({ input: child.stderr }).on("line", onLine);
		child.on("close", (code) => {
			resolve(code ?? NO_EXIT_CODE);
		});
	});
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

function writeLog(logFile: string, lines: readonly string[]): void {
	mkdirSync(path.dirname(logFile), { recursive: true });
	writeFileSync(logFile, `${lines.join("\n")}\n`);
}

/** Runs every check, as `ci:local --only` does, so one push shows every problem. True when they all pass. */
export async function runChecks({ title, subtitle, checks, cwd, stream, logFile, nextStep }: RunChecksOptions): Promise<boolean> {
	const live = stream.isTTY === true;
	const tint = live && stream.hasColors?.() === true ? COLOUR_TINT : PLAIN_TINT;
	const startedAtMs = Date.now();
	const region = new LiveRegion(stream);
	let progress: readonly CheckProgress[] = checks.map((check) => waitingCheck(check.id, check.label, check.task, check.note));
	let frame = 0;
	const allLines: string[] = [];
	const failures: string[] = [];

	const replace = (id: string, change: (check: CheckProgress) => CheckProgress): void => {
		progress = progress.map((check) => (check.id === id ? change(check) : check));
	};
	const draw = (): void => {
		frame += 1;
		region.draw(renderFrame({ title, subtitle, checks: progress, frame, nowMs: Date.now(), width: Math.min(stream.columns ?? DEFAULT_WIDTH, MAX_WIDTH), tint }));
	};
	// Ctrl+C must not leave the person's terminal with a hidden cursor.
	const onInterrupt = (): void => {
		region.close();
		process.exit(NO_EXIT_CODE);
	};

	if (live) {
		process.once("SIGINT", onInterrupt);
		region.open();
		draw();
	} else {
		stream.write(`${title}: ${subtitle}\n`);
	}
	const timer = live ? setInterval(draw, FRAME_INTERVAL_MS) : undefined;

	for (const check of checks) {
		replace(check.id, (current) => startCheck(current, Date.now()));
		const checkLines: string[] = [];
		const exitCode = await runCommand(check, cwd, process.env, (line) => {
			checkLines.push(line);
			allLines.push(line);
			replace(check.id, (current) => applyLine(current, line));
		});
		replace(check.id, (current) => finishCheck(current, exitCode === 0, Date.now()));
		if (exitCode !== 0) {
			failures.push(...failureLog(checkLines));
		}
		if (!live) {
			const finished = progress.find((current) => current.id === check.id);
			stream.write(`${exitCode === 0 ? "✓" : "✗"} ${check.label} (${formatDuration(finished?.elapsedMs ?? 0)})\n`);
		}
	}

	clearInterval(timer);
	if (live) {
		draw();
		region.close();
		process.off("SIGINT", onInterrupt);
	}
	writeLog(logFile, allLines);

	if (failures.length > 0) {
		stream.write(`${failures.join("\n")}\n\n${renderFailed(progress, tint)}\n  ${tint.quiet(`Full log: ${path.relative(cwd, logFile)}`)}\n\n`);
		return false;
	}
	stream.write(`${renderPassed(progress, Date.now() - startedAtMs, tint)}\n`);
	if (nextStep !== undefined) {
		stream.write(`  ${tint.active("→")} ${nextStep}\n`);
	}
	stream.write("\n");
	return true;
}

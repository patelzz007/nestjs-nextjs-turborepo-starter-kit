// What a git hook's check has done so far: the state render.ts draws. Pure and immutable, one line at a time.
import { parseJestTestTotal, parsePackageCount, parseTaskLine, parseTestFile, type TestFileResult } from "./task-output.ts";

export type CheckStatus = "waiting" | "running" | "passed" | "failed";

/** How many finished test files the display keeps on screen. */
export const RECENT_TEST_FILES = 5;

export interface CheckProgress {
	readonly id: string;
	readonly label: string;
	/** The turbo task whose lines count; undefined for a check that isn't a turbo task. */
	readonly task: string | undefined;
	/** A fixed note beside the label, when the check has no packages to count. */
	readonly note: string | undefined;
	readonly status: CheckStatus;
	readonly startedAtMs: number | undefined;
	readonly elapsedMs: number;
	readonly packagesTotal: number | undefined;
	readonly packagesSeen: ReadonlySet<string>;
	readonly currentWorkspace: string | undefined;
	readonly testFiles: number;
	readonly tests: number;
	readonly recent: readonly TestFileResult[];
}

export function waitingCheck(id: string, label: string, task: string | undefined, note?: string): CheckProgress {
	return {
		id,
		label,
		task,
		note,
		status: "waiting",
		startedAtMs: undefined,
		elapsedMs: 0,
		packagesTotal: undefined,
		packagesSeen: new Set(),
		currentWorkspace: undefined,
		testFiles: 0,
		tests: 0,
		recent: [],
	};
}

export function startCheck(check: CheckProgress, nowMs: number): CheckProgress {
	return { ...check, status: "running", startedAtMs: nowMs };
}

export function finishCheck(check: CheckProgress, passed: boolean, nowMs: number): CheckProgress {
	return { ...check, status: passed ? "passed" : "failed", elapsedMs: nowMs - (check.startedAtMs ?? nowMs), currentWorkspace: undefined };
}

/** Folds one output line into the check. */
export function applyLine(check: CheckProgress, rawLine: string): CheckProgress {
	const packagesTotal = parsePackageCount(rawLine);
	if (packagesTotal !== undefined) {
		return { ...check, packagesTotal };
	}
	const line = parseTaskLine(rawLine);
	if (line === undefined || line.task !== check.task) {
		return check;
	}
	const seen = { ...check, currentWorkspace: line.workspace, packagesSeen: new Set([...check.packagesSeen, line.workspace]) };
	const file = parseTestFile(line.text);
	if (file !== undefined) {
		return { ...seen, testFiles: seen.testFiles + 1, tests: seen.tests + (file.tests ?? 0), recent: [...seen.recent, file].slice(-RECENT_TEST_FILES) };
	}
	return { ...seen, tests: seen.tests + (parseJestTestTotal(line.text) ?? 0) };
}

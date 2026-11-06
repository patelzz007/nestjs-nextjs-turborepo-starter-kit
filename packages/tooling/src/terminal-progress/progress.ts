// What a git hook's check has done so far: the state the display draws. Pure and immutable, one line at a time.
import {
	isCacheHit,
	isPackageFinished,
	parseFailedTasks,
	parseFailedTest,
	parseJestTestTotal,
	parsePackageCount,
	parsePackagesInScope,
	parseStage,
	parseTaskLine,
	parseTestFile,
	type Stage,
	type TestFileResult,
} from "./task-output.ts";

export type CheckStatus = "waiting" | "running" | "passed" | "failed";

/** How many finished test files the display keeps to scroll through. */
export const RECENT_TEST_FILES = 500;
/** How many of the slowest test files the display keeps. */
export const SLOWEST_TEST_FILES = 100;
/** How many failures a check lists: past this, the log file has the rest. */
const MAX_FAILURES = 200;
const MAX_STAGES = 200;

/** One finished test file, and the package it belongs to. */
export interface TestFileLine extends TestFileResult {
	readonly workspace: string;
}

export interface PackageProgress {
	readonly name: string;
	readonly cached: boolean;
	readonly finished: boolean;
	readonly failed: boolean;
	readonly startedAtMs: number | undefined;
	readonly lastLineAtMs: number | undefined;
	readonly testFiles: number;
	readonly tests: number;
}

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
	readonly packages: ReadonlyMap<string, PackageProgress>;
	readonly currentWorkspace: string | undefined;
	readonly testFiles: number;
	readonly tests: number;
	readonly recent: readonly TestFileLine[];
	readonly slowest: readonly TestFileLine[];
	readonly failedFiles: readonly TestFileLine[];
	readonly failedTests: readonly string[];
	readonly stages: readonly Stage[];
	/** What the check printed about its failure, once it has failed. */
	readonly failureLog: readonly string[];
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
		packages: new Map(),
		currentWorkspace: undefined,
		testFiles: 0,
		tests: 0,
		recent: [],
		slowest: [],
		failedFiles: [],
		failedTests: [],
		stages: [],
		failureLog: [],
	};
}

function waitingPackage(name: string): PackageProgress {
	return { name, cached: false, finished: false, failed: false, startedAtMs: undefined, lastLineAtMs: undefined, testFiles: 0, tests: 0 };
}

export function startCheck(check: CheckProgress, nowMs: number): CheckProgress {
	return { ...check, status: "running", startedAtMs: nowMs };
}

export function finishCheck(check: CheckProgress, passed: boolean, nowMs: number, failureLog: readonly string[] = []): CheckProgress {
	return { ...check, status: passed ? "passed" : "failed", elapsedMs: nowMs - (check.startedAtMs ?? nowMs), currentWorkspace: undefined, failureLog };
}

/** How many packages the check has reached. */
export function packagesStarted(check: CheckProgress): number {
	return [...check.packages.values()].filter((item) => item.startedAtMs !== undefined).length;
}

export function packagesCached(check: CheckProgress): number {
	return [...check.packages.values()].filter((item) => item.cached).length;
}

/** How many separate things have gone wrong: the most specific count each check has. */
export function problemCount(checks: readonly CheckProgress[]): number {
	return checks.reduce((sum, check) => sum + Math.max(check.failedTests.length, check.failedFiles.length, check.status === "failed" ? 1 : 0), 0);
}

function withPackage(check: CheckProgress, name: string, change: (item: PackageProgress) => PackageProgress): CheckProgress {
	return { ...check, packages: new Map(check.packages).set(name, change(check.packages.get(name) ?? waitingPackage(name))) };
}

function withFile(check: CheckProgress, file: TestFileLine): CheckProgress {
	return {
		...check,
		testFiles: check.testFiles + 1,
		tests: check.tests + (file.tests ?? 0),
		recent: [...check.recent, file].slice(-RECENT_TEST_FILES),
		slowest:
			file.durationMs === undefined ? check.slowest : [...check.slowest, file].toSorted((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0)).slice(0, SLOWEST_TEST_FILES),
		failedFiles: file.passed ? check.failedFiles : [...check.failedFiles, file].slice(0, MAX_FAILURES),
	};
}

function withFailedTasks(check: CheckProgress, tasks: readonly string[]): CheckProgress {
	return tasks.reduce((current, task) => {
		const [workspace, name] = task.split("#");
		return workspace === undefined || name !== check.task ? current : withPackage(current, workspace, (item) => ({ ...item, failed: true }));
	}, check);
}

/** Folds one line of a task into the check. */
function applyTaskText(check: CheckProgress, workspace: string, text: string, nowMs: number): CheckProgress {
	const seen = withPackage({ ...check, currentWorkspace: workspace }, workspace, (item) => ({
		...item,
		startedAtMs: item.startedAtMs ?? nowMs,
		lastLineAtMs: nowMs,
		cached: item.cached || isCacheHit(text),
		finished: item.finished || isPackageFinished(text),
	}));
	const failedTest = parseFailedTest(text);
	if (failedTest !== undefined) {
		const failed = withPackage(seen, workspace, (item) => ({ ...item, failed: true }));
		return failed.failedTests.includes(failedTest) ? failed : { ...failed, failedTests: [...failed.failedTests, failedTest].slice(0, MAX_FAILURES) };
	}
	const file = parseTestFile(text);
	if (file !== undefined) {
		const counted = withPackage(seen, workspace, (item) => ({
			...item,
			testFiles: item.testFiles + 1,
			tests: item.tests + (file.tests ?? 0),
			failed: item.failed || !file.passed,
		}));
		return withFile(counted, { ...file, workspace });
	}
	const jestTotal = parseJestTestTotal(text) ?? 0;
	return jestTotal === 0 ? seen : withPackage({ ...seen, tests: seen.tests + jestTotal }, workspace, (item) => ({ ...item, tests: item.tests + jestTotal }));
}

/** Folds one output line into the check. */
export function applyLine(check: CheckProgress, rawLine: string, nowMs: number): CheckProgress {
	if (check.task === undefined) {
		const stage = parseStage(rawLine);
		return stage === undefined ? check : { ...check, stages: [...check.stages, stage].slice(-MAX_STAGES) };
	}
	const scope = parsePackagesInScope(rawLine);
	if (scope !== undefined) {
		return { ...check, packages: new Map(scope.map((name) => [name, check.packages.get(name) ?? waitingPackage(name)])) };
	}
	const packagesTotal = parsePackageCount(rawLine);
	if (packagesTotal !== undefined) {
		return { ...check, packagesTotal };
	}
	const failedTasks = parseFailedTasks(rawLine);
	if (failedTasks.length > 0) {
		return withFailedTasks(check, failedTasks);
	}
	const line = parseTaskLine(rawLine);
	return line === undefined || line.task !== check.task ? check : applyTaskText(check, line.workspace, line.text, nowMs);
}

// Reads the lines turbo and the test runners print, for the git hooks' live display (progress.ts). Pure, so every
// format is unit-tested. A line this doesn't recognise is simply not shown; the hook's result comes from the exit
// code, never from here.
import { stripVTControlCharacters } from "node:util";

/** One line of a turbo task: `@workspace/api:test: <text>`. */
export interface TaskLine {
	readonly workspace: string;
	readonly task: string;
	readonly text: string;
}

/** One finished test file. `tests` is unknown for Jest, which reports its count once, at the end; Jest only times a slow file. */
export interface TestFileResult {
	readonly file: string;
	readonly passed: boolean;
	readonly tests: number | undefined;
	readonly durationMs: number | undefined;
}

export type StageStatus = "running" | "passed" | "failed" | "skipped";

/** One step lint-staged reports. */
export interface Stage {
	readonly text: string;
	readonly status: StageStatus;
}

const TASK_LINE = /^(?<workspace>[^\s:]+):(?<task>[^\s:]+(?::[^\s:]+)*): ?(?<text>.*)$/u;
const PACKAGE_COUNT = /Running \S+ in (?<count>\d+) packages?/u;
const PACKAGES_IN_SCOPE = /Packages in scope: (?<names>.+)$/u;
const VITEST_FILE = /^\s*(?<mark>✓|❯|×)\s+(?<file>\S+)\s+\((?<tests>\d+) tests?(?<failed> \| \d+ failed)?[^)]*\)(?:\s+(?<duration>[\d.]+)(?<unit>ms|s)\b)?/u;
const JEST_FILE = /^\s*(?<mark>PASS|FAIL)\s+(?<file>\S+)(?:\s+\((?<seconds>[\d.]+) s\))?/u;
const VITEST_FAILED_TEST = /^\s*FAIL\s+(?<name>\S+\s+>\s+.+)$/u;
const JEST_FAILED_TEST = /^\s*●\s+(?<name>.+)$/u;
/** Jest's heading for captured console output, which reuses the failure bullet. */
const JEST_CONSOLE_HEADING = "Console";
const CACHE_HIT = "cache hit";
const PACKAGE_FINISHED = /^\s*(?:Test Files\s+\d|Tests:\s+\d)/u;
const STAGE = /^\s*(?<mark>⋯|✔|✖|↓)\s+(?<text>.+)$/u;
/** A staged-lint command, thousands of characters long with its file list: `node …/cli.ts "apps/web" oxlint … files`. */
const STAGE_COMMAND = /^node \S+ "(?<folder>[^"]+)" (?<tool>\S+)/u;
const MS_PER_SECOND = 1000;
const STAGE_STATUS: Readonly<Record<string, StageStatus>> = { "⋯": "running", "✔": "passed", "✖": "failed", "↓": "skipped" };
const JEST_TOTAL = /^\s*Tests:\s+(?:\d+ failed, )?(?:\d+ skipped, )?(?<passed>\d+) passed/u;
const FAILED_TASKS = /^\s*Failed:\s+(?<tasks>.+)$/u;

export function parseTaskLine(rawLine: string): TaskLine | undefined {
	const { workspace, task, text } = TASK_LINE.exec(stripVTControlCharacters(rawLine))?.groups ?? {};
	return workspace === undefined || task === undefined || text === undefined ? undefined : { workspace, task, text };
}

/** How many packages turbo says it will run a task in. */
export function parsePackageCount(rawLine: string): number | undefined {
	const count = PACKAGE_COUNT.exec(stripVTControlCharacters(rawLine))?.groups?.count;
	return count === undefined ? undefined : Number(count);
}

/** Every package turbo will look at, so the ones it hasn't reached can be shown waiting. */
export function parsePackagesInScope(rawLine: string): readonly string[] | undefined {
	const names = PACKAGES_IN_SCOPE.exec(stripVTControlCharacters(rawLine))?.groups?.names;
	return names?.split(",").map((name) => name.trim());
}

function vitestDuration(duration: string | undefined, unit: string | undefined): number | undefined {
	if (duration === undefined) {
		return undefined;
	}
	return unit === "s" ? Number(duration) * MS_PER_SECOND : Number(duration);
}

export function parseTestFile(text: string): TestFileResult | undefined {
	const vitest = VITEST_FILE.exec(text)?.groups;
	if (vitest?.file !== undefined) {
		return {
			file: vitest.file,
			passed: vitest.mark === "✓" && vitest.failed === undefined,
			tests: Number(vitest.tests),
			durationMs: vitestDuration(vitest.duration, vitest.unit),
		};
	}
	const jest = JEST_FILE.exec(text)?.groups;
	if (jest?.file === undefined) {
		return undefined;
	}
	return { file: jest.file, passed: jest.mark === "PASS", tests: undefined, durationMs: jest.seconds === undefined ? undefined : Number(jest.seconds) * MS_PER_SECOND };
}

/** The name of a test that failed. Checked before {@link parseTestFile}: Vitest's `FAIL  file > test` looks like Jest's `FAIL file`. */
export function parseFailedTest(text: string): string | undefined {
	const name = VITEST_FAILED_TEST.exec(text)?.groups?.name ?? JEST_FAILED_TEST.exec(text)?.groups?.name;
	return name === JEST_CONSOLE_HEADING ? undefined : name;
}

/** Whether turbo replayed this task from its cache instead of running it. */
export function isCacheHit(text: string): boolean {
	return text.startsWith(CACHE_HIT);
}

/** A test runner's closing totals: that package has finished. */
export function isPackageFinished(text: string): boolean {
	return PACKAGE_FINISHED.test(text);
}

export function parseStage(rawLine: string): Stage | undefined {
	const { mark, text } = STAGE.exec(stripVTControlCharacters(rawLine))?.groups ?? {};
	const status = mark === undefined ? undefined : STAGE_STATUS[mark];
	if (status === undefined || text === undefined) {
		return undefined;
	}
	const { folder, tool } = STAGE_COMMAND.exec(text)?.groups ?? {};
	return { text: folder === undefined || tool === undefined ? text : `${tool} in ${folder}`, status };
}

/** Jest's closing count. Vitest's isn't read: its file lines already carry the counts. */
export function parseJestTestTotal(text: string): number | undefined {
	const passed = JEST_TOTAL.exec(text)?.groups?.passed;
	return passed === undefined ? undefined : Number(passed);
}

/** The tasks turbo names as failed (`Failed:    @workspace/ui#test, @workspace/api#test`). */
export function parseFailedTasks(rawLine: string): readonly string[] {
	const tasks = FAILED_TASKS.exec(stripVTControlCharacters(rawLine))?.groups?.tasks;
	return tasks === undefined ? [] : tasks.split(",").map((task) => task.trim());
}

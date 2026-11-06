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

/** One finished test file. `tests` is unknown for Jest, which reports its count once, at the end. */
export interface TestFileResult {
	readonly file: string;
	readonly passed: boolean;
	readonly tests: number | undefined;
}

const TASK_LINE = /^(?<workspace>[^\s:]+):(?<task>[^\s:]+(?::[^\s:]+)*): ?(?<text>.*)$/u;
const PACKAGE_COUNT = /Running \S+ in (?<count>\d+) packages?/u;
const VITEST_FILE = /^\s*(?<mark>✓|❯|×)\s+(?<file>\S+)\s+\((?<tests>\d+) tests?(?<failed> \| \d+ failed)?/u;
const JEST_FILE = /^\s*(?<mark>PASS|FAIL)\s+(?<file>\S+)/u;
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

export function parseTestFile(text: string): TestFileResult | undefined {
	const vitest = VITEST_FILE.exec(text)?.groups;
	if (vitest?.file !== undefined) {
		return { file: vitest.file, passed: vitest.mark === "✓" && vitest.failed === undefined, tests: Number(vitest.tests) };
	}
	const jest = JEST_FILE.exec(text)?.groups;
	return jest?.file === undefined ? undefined : { file: jest.file, passed: jest.mark === "PASS", tests: undefined };
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

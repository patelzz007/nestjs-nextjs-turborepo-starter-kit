import { settings } from "../shared/settings.ts";

/**
 * Where unit tests live (rules/11 → "Where tests live"): every `*.test.ts(x)`
 * of the front-end apps, the infrastructure app and EVERY package sits in a `__tests__/` folder
 * beside the code it tests, never next to it. Next.js treats `_`-prefixed folders inside `app/`
 * as private (never a route), and the test runners only collect `__tests__/`,
 * so a test left beside its code would silently stop running — this check
 * fails instead.
 */

/** The workspaces whose tests must live in `__tests__/` folders. */
export const TEST_PLACEMENT_WORKSPACES: readonly string[] = settings.testPlacementWorkspaces;

const TEST_FILE_PATTERN = /\.test\.(?:ts|tsx|mts|js|mjs|cjs)$/u;

/**
 * The test files (repository-relative paths) that are not inside a
 * `__tests__/` folder, of the given workspaces.
 * @param files repository-relative paths, `/`-separated
 * @param workspaces workspace folders to check
 */

export function misplacedTestFiles(files: readonly string[], workspaces: readonly string[]): string[] {
	return files.filter((file) => TEST_FILE_PATTERN.test(file) && workspaces.some((workspace) => file.startsWith(`${workspace}/`)) && !file.split("/").includes("__tests__"));
}

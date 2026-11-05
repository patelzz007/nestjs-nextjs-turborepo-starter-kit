/**
 * The `changes` job of .github/workflows/ci.yml (enhancement 3.6): does a pull request touch anything but
 * documentation? Documentation is read by the docs site alone (apps/docs renders `docs/` and `blog/`; no
 * other workspace reads a Markdown file), so a pull request that changes only documentation cannot change
 * what the database, browser and most unit-test jobs prove; those jobs skip it. Lint, the build (it renders
 * the docs site), the docs unit tests, the link check and the secret scan still run. Pushes to `main` and
 * manual runs always run everything. Pure, so unit-tested.
 */

import { parseArgs } from "node:util";

/** The folders the docs site renders. */
const DOCUMENTATION_FOLDERS = ["docs/", "blog/"];

/**
 * Generated artifacts kept under docs/ that code checks: the API's e2e suite proves `docs/generated/openapi.json`
 * matches the code (ADR 022), and the docs build reads the captured API samples. A change there is code.
 */
const GENERATED_FOLDER = "docs/generated/";

/** Markdown anywhere: READMEs, rules, ADRs, the progress log. */
const MARKDOWN_EXTENSION = ".md";

/** Whether one repository path is documentation. */
export function isDocumentation(file) {
	if (file.startsWith(GENERATED_FOLDER)) {
		return false;
	}
	return DOCUMENTATION_FOLDERS.some((folder) => file.startsWith(folder)) || file.endsWith(MARKDOWN_EXTENSION);
}

/**
 * Whether the code jobs must run: on any event but a pull request, and on a pull request that changes
 * anything that is not documentation. An empty list (the diff could not be listed, or the branch changes
 * nothing) runs everything: skipping is only ever decided on positive evidence.
 */
export function codeChanged(eventName, changedFiles) {
	if (eventName !== "pull_request") {
		return true;
	}
	return changedFiles.length === 0 || !changedFiles.every(isDocumentation);
}

/** `git diff`'s arguments: the files a pull request changes relative to where it branched from its base. */
export function changedFilesArgs(baseRef) {
	return ["diff", "--name-only", "--no-renames", `${baseRef}...HEAD`];
}

/** `git diff --name-only`'s output as paths. */
export function changedFilesOf(gitOutput) {
	return gitOutput
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
}

/** The lines the job appends to `$GITHUB_OUTPUT`. */
export function outputLines(code) {
	return `code=${String(code)}\n`;
}

/** The script's inputs. CI passes them as arguments (never read from the environment: they are not turbo inputs). */
const DEFAULT_BASE_REF = "origin/main";

/**
 * `--event <GitHub event name> --base <origin/branch> --output <$GITHUB_OUTPUT file>`; `--output` is optional
 * (without it the answer is only printed), `--base` defaults to `origin/main`.
 *
 * @param {readonly string[]} argv
 * @returns {{ eventName: string, baseRef: string, outputFile: string | undefined }}
 */
export function parseChangesArgs(argv) {
	const { values } = parseArgs({ args: [...argv], options: { event: { type: "string" }, base: { type: "string" }, output: { type: "string" } }, strict: true });
	return { eventName: values.event ?? "", baseRef: values.base ?? DEFAULT_BASE_REF, outputFile: values.output === "" ? undefined : values.output };
}

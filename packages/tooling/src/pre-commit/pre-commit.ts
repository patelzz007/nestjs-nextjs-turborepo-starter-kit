// The pre-commit hook's note beside its check (src/pre-commit/cli.ts).

/** `git diff --name-only` output, as what the hook is about to check. */
export function stagedFilesNote(nameOnlyOutput: string): string {
	const count = nameOnlyOutput.split("\n").filter((line) => line.trim().length > 0).length;
	return `${new Intl.NumberFormat("en-US").format(count)} staged file${count === 1 ? "" : "s"}`;
}

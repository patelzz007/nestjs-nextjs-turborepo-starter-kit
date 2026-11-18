// The pre-commit hook's note beside its check (src/pre-commit/cli.ts).

/**
 * Whether the staged files (`git diff --name-only` output) touch an input of the generated security SQL (ADR 089;
 * `tooling.config.ts` `securitySql.inputs`, a trailing `/` meaning a whole folder): such a commit must come with the
 * regenerated SQL, which the security check proves.
 */
export function touchesSecuritySql(nameOnlyOutput: string, inputs: readonly string[]): boolean {
	return nameOnlyOutput
		.split("\n")
		.map((line) => line.trim())
		.some((file) => inputs.some((input) => (input.endsWith("/") ? file.startsWith(input) : file === input)));
}

/** `git diff --name-only` output, as what the hook is about to check. */
export function stagedFilesNote(nameOnlyOutput: string): string {
	const count = nameOnlyOutput.split("\n").filter((line) => line.trim().length > 0).length;
	return `${new Intl.NumberFormat("en-US").format(count)} staged file${count === 1 ? "" : "s"}`;
}

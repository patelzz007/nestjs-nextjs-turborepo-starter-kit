// The pre-push hook's plan (src/pre-push/cli.ts): the same lint, typecheck and
// unit-test steps `pnpm ci:local` runs — taken from its plan, so the two can
// never drift — before anything leaves the machine.

/** The `ci:local` step ids a push must pass (ci-local-plan.ts → staticSteps). */
export const PRE_PUSH_STEP_IDS = ["lint", "typecheck", "test"];

/** What each step is called on screen. */
export const PRE_PUSH_LABELS: Readonly<Record<string, string>> = { lint: "Lint", typecheck: "Typecheck", test: "Unit tests" };

/** The object id git writes for a ref that is being deleted. */
const ZERO_OBJECT_ID = /^0+$/;

/**
 * Whether a push only deletes remote refs (nothing new to check). git hands
 * the hook one line per ref on stdin: `<local ref> <local oid> <remote ref> <remote oid>`;
 * a deletion has an all-zero local oid. No lines: nothing is pushed.
 */

export function pushesNothingNew(stdin: string): boolean {
	return stdin
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.every((line) => ZERO_OBJECT_ID.test(line.split(/\s+/).at(1) ?? ""));
}

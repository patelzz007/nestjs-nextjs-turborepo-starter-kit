// The pre-push hook's plan (scripts/pre-push.mjs): the same lint, typecheck and
// unit-test steps `pnpm ci:local` runs — taken from its plan, so the two can
// never drift — before anything leaves the machine.

/** The `ci:local` step ids a push must pass (lib/ci-local-plan.mjs → staticSteps). */
export const PRE_PUSH_STEP_IDS = ["lint", "typecheck", "test"];

/** The object id git writes for a ref that is being deleted. */
const ZERO_OBJECT_ID = /^0+$/;

/**
 * Whether a push only deletes remote refs (nothing new to check). git hands
 * the hook one line per ref on stdin: `<local ref> <local oid> <remote ref> <remote oid>`;
 * a deletion has an all-zero local oid. No lines: nothing is pushed.
 *
 * @param {string} stdin
 * @returns {boolean}
 */
export function pushesNothingNew(stdin) {
	return stdin
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.every((line) => ZERO_OBJECT_ID.test(line.split(/\s+/).at(1) ?? ""));
}

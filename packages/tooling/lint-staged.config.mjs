// The pre-commit hook's config (.husky/pre-commit runs lint-staged with it,
// from the repository root): format and lint the staged files with the tools
// of the workspace that owns each one (scripts/lib/staged-lint.mjs).
// Typecheck and the unit tests run on pre-push; everything runs in CI.
import path from "node:path";

import { LINTED_GLOB, stagedLintCommands } from "./scripts/lib/staged-lint.mjs";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");

export default {
	[LINTED_GLOB]: (files) => stagedLintCommands(REPO_ROOT, files),
};

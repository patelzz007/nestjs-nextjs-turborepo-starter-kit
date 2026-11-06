// The pre-commit hook loads lint-staged.config.mjs, and nothing else does: a config that fails to load stops every
// commit, and only a commit would show it. This test loads the real file, the way lint-staged does.
import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { LINTED_GLOB, RUN_IN_WORKSPACE } from "../staged-lint.ts";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../../../..");
const STAGED_FILE = path.join(REPO_ROOT, "packages/tooling/src/staged-lint/staged-lint.ts");

describe("lint-staged.config.mjs", () => {
	it("loads, and turns a staged file into its workspace's commands", async () => {
		const { default: config } = await import("../../../lint-staged.config.mjs");

		expect(Object.keys(config)).toEqual([LINTED_GLOB]);
		expect(config[LINTED_GLOB]?.([STAGED_FILE]).join("\n")).toContain(RUN_IN_WORKSPACE);
	});

	it("names a runner that exists", () => {
		expect(existsSync(path.join(REPO_ROOT, RUN_IN_WORKSPACE))).toBe(true);
	});
});

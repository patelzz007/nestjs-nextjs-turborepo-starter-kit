import path from "node:path";

import { describe, expect, it } from "vitest";

import { workingTreeFiles } from "../scripts/lib/working-tree-files.mjs";

import { misplacedTestFiles, TEST_PLACEMENT_WORKSPACES } from "../scripts/lib/test-placement.mjs";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");

describe("misplacedTestFiles", () => {
	it("flags a test beside its code, and accepts one in a __tests__ folder at any depth", () => {
		const files = [
			"apps/web/lib/routes.test.ts",
			"apps/web/lib/__tests__/routes.test.ts",
			"apps/mobile/src/__tests__/app/(app)/profile.test.tsx",
			"apps/web/lib/routes.ts",
			"apps/api/src/app.spec.ts",
			"packages/ui/src/components/button.test.tsx",
		];
		expect(misplacedTestFiles(files, ["apps/web", "apps/mobile"])).toStrictEqual(["apps/web/lib/routes.test.ts"]);
	});
});

describe("front-end test placement", () => {
	it("keeps every test of the web, admin, merchant, docs, mobile and ui-native workspaces in a __tests__ folder", () => {
		// Tracked and new (untracked, not ignored) files, so a fresh misplaced test fails before it is committed.
		const files = workingTreeFiles(REPO_ROOT, TEST_PLACEMENT_WORKSPACES);
		expect(misplacedTestFiles(files, TEST_PLACEMENT_WORKSPACES)).toStrictEqual([]);
	});
});

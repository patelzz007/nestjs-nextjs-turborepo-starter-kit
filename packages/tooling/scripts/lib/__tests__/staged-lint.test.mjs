import { execSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { LINTED_GLOB, owningWorkspace, stagedLintCommands } from "../staged-lint.mjs";

const ROOT = "/repo";

describe("LINTED_GLOB", () => {
	it("covers the extensions every workspace's lint script formats", () => {
		expect(LINTED_GLOB).toBe("*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}");
	});
});

describe("owningWorkspace", () => {
	let repo = "";

	beforeEach(() => {
		repo = mkdtempSync(path.join(tmpdir(), "staged-lint-"));
		writeFileSync(path.join(repo, "package.json"), JSON.stringify({ scripts: { lint: "turbo lint" } }));
		mkdirSync(path.join(repo, "apps/api/src/deep"), { recursive: true });
		writeFileSync(path.join(repo, "apps/api/package.json"), JSON.stringify({ scripts: { lint: "oxlint" } }));
		mkdirSync(path.join(repo, "packages/typescript-config"), { recursive: true });
		writeFileSync(path.join(repo, "packages/typescript-config/package.json"), JSON.stringify({ scripts: {} }));
	});

	afterEach(() => {
		rmSync(repo, { recursive: true, force: true });
	});

	it("finds the nearest workspace with a lint script", () => {
		expect(owningWorkspace(repo, path.join(repo, "apps/api/src/deep/file.ts"))).toBe(path.join(repo, "apps/api"));
	});

	it("never picks the repository root, nor a workspace without a lint script", () => {
		expect(owningWorkspace(repo, path.join(repo, "root.config.mjs"))).toBeUndefined();
		expect(owningWorkspace(repo, path.join(repo, "packages/typescript-config/base.js"))).toBeUndefined();
	});
});

describe("stagedLintCommands", () => {
	const workspaceOf = (file) => (file.startsWith(`${ROOT}/apps/api/`) ? `${ROOT}/apps/api` : file.startsWith(`${ROOT}/packages/ui/`) ? `${ROOT}/packages/ui` : undefined);

	it("formats then lints each workspace's files with that workspace's tools", () => {
		const commands = stagedLintCommands(ROOT, [`${ROOT}/apps/api/src/a.ts`, `${ROOT}/packages/ui/src/b.tsx`, `${ROOT}/apps/api/test/c.ts`], workspaceOf);

		expect(commands).toStrictEqual([
			'node packages/tooling/scripts/run-in-workspace.mjs "apps/api" oxfmt --no-error-on-unmatched-pattern "src/a.ts" "test/c.ts"',
			'node packages/tooling/scripts/run-in-workspace.mjs "apps/api" oxlint --no-error-on-unmatched-pattern "src/a.ts" "test/c.ts"',
			'node packages/tooling/scripts/run-in-workspace.mjs "packages/ui" oxfmt --no-error-on-unmatched-pattern "src/b.tsx"',
			'node packages/tooling/scripts/run-in-workspace.mjs "packages/ui" oxlint --no-error-on-unmatched-pattern "src/b.tsx"',
		]);
	});

	it("quotes paths with spaces and quotes, and leaves files no workspace lints alone", () => {
		expect(stagedLintCommands(ROOT, [`${ROOT}/apps/api/src/my "file".ts`, `${ROOT}/lint-staged.config.mjs`], workspaceOf)).toStrictEqual([
			'node packages/tooling/scripts/run-in-workspace.mjs "apps/api" oxfmt --no-error-on-unmatched-pattern "src/my \\"file\\".ts"',
			'node packages/tooling/scripts/run-in-workspace.mjs "apps/api" oxlint --no-error-on-unmatched-pattern "src/my \\"file\\".ts"',
		]);
		expect(stagedLintCommands(ROOT, [`${ROOT}/lint-staged.config.mjs`], workspaceOf)).toStrictEqual([]);
	});
});

describe("the generated commands on a real workspace", () => {
	const repoRoot = path.resolve(import.meta.dirname, "../../../../..");

	it("pass when every staged file is one the workspace's lint ignores (apps/admin ignores vitest.config.ts)", () => {
		const commands = stagedLintCommands(repoRoot, [path.join(repoRoot, "apps/admin/vitest.config.ts")]);

		for (const command of commands) {
			expect(execSync(command, { cwd: repoRoot, stdio: "pipe" }).toString()).toBeDefined();
		}
		expect(commands).toHaveLength(2);
	});
});

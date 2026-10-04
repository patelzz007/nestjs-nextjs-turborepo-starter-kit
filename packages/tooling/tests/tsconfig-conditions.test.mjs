/**
 * Workspace packages such as @workspace/shared export their TypeScript source
 * under a `development` condition and their build output (dist/) otherwise.
 * A tsconfig that imports one of them WITHOUT `customConditions: ["development"]`
 * resolves the import to dist/: that works on a laptop with a stale build and
 * fails in a clean CI checkout (lint reports every import as an unresolved
 * `error` type). This test resolves every tsconfig in the repo (following
 * `extends`) and fails when one is missing the condition.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
const SOURCE_CONDITION = "development";
const WORKSPACE_SCOPE = "@workspace/";

function readJson(filePath) {
	return JSON.parse(readFileSync(filePath, "utf8"));
}

/** True when any entry of an `exports` map (at any depth) is keyed by the source condition. */
function hasSourceCondition(exportsField) {
	if (exportsField === null || typeof exportsField !== "object") {
		return false;
	}
	return Object.entries(exportsField).some(([key, value]) => key === SOURCE_CONDITION || hasSourceCondition(value));
}

function trackedFiles(pattern) {
	// Tracked or new (not ignored) and present on disk.
	return execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "--", pattern], { cwd: REPO_ROOT, encoding: "utf8" })
		.split("\n")
		.filter((line) => line.length > 0 && existsSync(path.join(REPO_ROOT, line)));
}

/** Workspace name → whether its exports map uses the `development` source condition. */
const workspaceManifests = new Map(
	trackedFiles("*package.json")
		.filter((file) => /^(apps|packages)\/[^/]+\/package\.json$/.test(file))
		.map((file) => [path.dirname(file), readJson(path.join(REPO_ROOT, file))]),
);
const conditionalPackages = new Set([...workspaceManifests.values()].filter((manifest) => hasSourceCondition(manifest.exports)).map((manifest) => manifest.name));

/** tsconfig files of workspaces that depend on a package with a `development` export. */
const tsconfigsNeedingCondition = trackedFiles("*tsconfig*.json")
	.filter((file) => /^(apps|packages)\//.test(file))
	.filter((file) => {
		const manifest = workspaceManifests.get(file.split("/").slice(0, 2).join("/"));
		const dependencies = Object.keys({ ...manifest?.dependencies, ...manifest?.devDependencies });
		return dependencies.some((name) => name.startsWith(WORKSPACE_SCOPE) && conditionalPackages.has(name));
	});

function resolvedCustomConditions(tsconfigFile) {
	const absolutePath = path.join(REPO_ROOT, tsconfigFile);
	const parsed = ts.getParsedCommandLineOfConfigFile(absolutePath, {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => undefined });
	return parsed?.options.customConditions ?? [];
}

describe("tsconfig resolution of @workspace packages", () => {
	it("finds the conditional workspace packages and the tsconfigs that import them", () => {
		expect(conditionalPackages.has("@workspace/shared")).toBe(true);
		expect(tsconfigsNeedingCondition).toContain("apps/analytics-consumer/tsconfig.json");
	});

	it.each(tsconfigsNeedingCondition)("%s resolves @workspace imports through the `development` condition", (tsconfigFile) => {
		expect(resolvedCustomConditions(tsconfigFile)).toContain(SOURCE_CONDITION);
	});
});

/**
 * Workspace packages such as @workspace/shared export their TypeScript source
 * under a `development` condition and their build output (dist/) otherwise.
 * A tsconfig that imports one of them WITHOUT `customConditions: ["development"]`
 * resolves the import to dist/: that works on a laptop with a stale build and
 * fails in a clean CI checkout (lint reports every import as an unresolved
 * `error` type). This test resolves every tsconfig in the repo (following
 * `extends`) and fails when one is missing the condition.
 *
 * The resolution is TypeScript's own: `tsc --showConfig` prints the config with
 * every `extends` applied. TypeScript 7 ships no stable JS API (only
 * `typescript/unstable/*`), and tsrs, which type-checks the repo, does not
 * implement `--showConfig`, so the TypeScript 7 CLI is the stable way to ask.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { workingTreeFiles } from "../../shared/working-tree-files.ts";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../../../..");
const SOURCE_CONDITION = "development";
const WORKSPACE_SCOPE = "@workspace/";

const WorkspaceManifestSchema = z.looseObject({
	name: z.string().optional(),
	exports: z.json().optional(),
	dependencies: z.record(z.string(), z.string()).optional(),
	devDependencies: z.record(z.string(), z.string()).optional(),
});

/** An `exports` map or list: anything else (a plain path) holds no condition. */
const ExportsContainerSchema = z.union([z.record(z.string(), z.json()), z.array(z.json())]);

function readManifest(filePath: string): z.output<typeof WorkspaceManifestSchema> {
	return WorkspaceManifestSchema.parse(JSON.parse(readFileSync(filePath, "utf8")));
}

/** True when any entry of an `exports` map (at any depth) is keyed by the source condition. */
function hasSourceCondition(exportsField: z.output<typeof ExportsContainerSchema> | z.output<ReturnType<typeof z.json>> | undefined): boolean {
	const container = ExportsContainerSchema.safeParse(exportsField);
	return container.success && Object.entries(container.data).some(([key, value]) => key === SOURCE_CONDITION || hasSourceCondition(value));
}

function trackedFiles(pattern: string): string[] {
	return workingTreeFiles(REPO_ROOT, [pattern]);
}

/** Workspace name → whether its exports map uses the `development` source condition. */
const workspaceManifests = new Map(
	trackedFiles("*package.json")
		.filter((file) => /^(apps|packages)\/[^/]+\/package\.json$/.test(file))
		.map((file): [string, z.output<typeof WorkspaceManifestSchema>] => [path.dirname(file), readManifest(path.join(REPO_ROOT, file))]),
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

const TypeScriptManifestSchema = z.object({ bin: z.object({ tsc: z.string() }) });
const typescriptManifestPath = createRequire(import.meta.url).resolve("typescript/package.json");
const TSC_BIN = path.join(path.dirname(typescriptManifestPath), TypeScriptManifestSchema.parse(JSON.parse(readFileSync(typescriptManifestPath, "utf8"))).bin.tsc);

const ShownConfigSchema = z
	.object({
		compilerOptions: z
			.object({ customConditions: z.array(z.string()).optional() })
			.loose()
			.optional(),
	})
	.loose();

function resolvedCustomConditions(tsconfigFile: string): string[] {
	const output = execFileSync(process.execPath, [TSC_BIN, "--showConfig", "-p", path.join(REPO_ROOT, tsconfigFile)], { cwd: REPO_ROOT, encoding: "utf8" });
	return ShownConfigSchema.parse(JSON.parse(output)).compilerOptions?.customConditions ?? [];
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

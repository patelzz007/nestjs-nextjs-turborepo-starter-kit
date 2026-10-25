/**
 * `pnpm deps:check` (CI: "Shared dependency versions are aligned") must lint
 * the WHOLE workspace. It used to run `syncpack lint` inside packages/tooling,
 * where syncpack discovers only that package and none of the repository's
 * .syncpackrc.json: the check passed while real drift sat in other workspaces.
 * This test proves the script runs syncpack from the repository root and that,
 * from there, syncpack sees every workspace manifest and the pnpm overrides,
 * with peer ranges in their own ignored group (pnpm peers check covers them).
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { z } from "zod";

const TOOLING_ROOT = path.resolve(import.meta.dirname, "..");
const REPO_ROOT = path.resolve(TOOLING_ROOT, "../..");
const SYNCPACK_BIN = path.join(TOOLING_ROOT, "node_modules", ".bin", "syncpack");
const CD_PREFIX = /^cd (?<directory>\S+) && /u;

const ManifestSchema = z
	.object({
		name: z.string().optional(),
		scripts: z.record(z.string(), z.string()).optional(),
		dependencies: z.record(z.string(), z.string()).optional(),
		devDependencies: z.record(z.string(), z.string()).optional(),
		peerDependencies: z.record(z.string(), z.string()).optional(),
	})
	.loose();

const InstanceSchema = z.object({ package: z.string(), dependencyType: z.string(), versionGroup: z.string() }).loose();

function manifest(directory) {
	return ManifestSchema.parse(JSON.parse(readFileSync(path.join(directory, "package.json"), "utf8")));
}

/** Every workspace manifest (root, apps/*, packages/*) that declares at least one dependency. */
function manifestsWithDependencies() {
	const workspaces = ["apps", "packages"].flatMap((folder) =>
		readdirSync(path.join(REPO_ROOT, folder), { withFileTypes: true })
			.filter((entry) => entry.isDirectory())
			.map((entry) => path.join(REPO_ROOT, folder, entry.name)),
	);
	return [REPO_ROOT, ...workspaces].filter((directory) => {
		const { dependencies = {}, devDependencies = {}, peerDependencies = {} } = manifest(directory);
		return Object.keys({ ...dependencies, ...devDependencies, ...peerDependencies }).length > 0;
	});
}

/** What syncpack inspects when it runs from `directory` (one JSON object per dependency instance). */
function syncpackInstances(directory) {
	const output = execFileSync(SYNCPACK_BIN, ["json"], { cwd: directory, encoding: "utf8" });
	return output
		.split("\n")
		.filter((line) => line.trim() !== "")
		.map((line) => InstanceSchema.parse(JSON.parse(line)));
}

describe("deps:check lints the whole workspace", () => {
	const script = manifest(TOOLING_ROOT).scripts?.["deps:check"] ?? "";
	const directory = path.resolve(TOOLING_ROOT, CD_PREFIX.exec(script)?.groups?.directory ?? ".");
	const instances = syncpackInstances(directory);

	it("runs syncpack and pnpm peers check from the repository root", () => {
		expect(directory).toBe(REPO_ROOT);
		expect(script).toContain("syncpack lint");
		expect(script).toContain("pnpm peers check");
	});

	it("sees every workspace manifest that declares a dependency", () => {
		const seen = new Set(instances.map((instance) => path.dirname(instance.package)));
		expect([...seen].sort()).toEqual(expect.arrayContaining(manifestsWithDependencies().sort()));
	});

	it("sees the pnpm-workspace.yaml overrides", () => {
		expect(instances.some((instance) => instance.dependencyType === "pnpmOverrides")).toBe(true);
	});

	it("keeps peer ranges out of every version group (they are ignored; pnpm peers check covers them)", () => {
		// `syncpack json` leaves ignored instances out, so a declared peer must not show up at all.
		const declaredPeers = manifestsWithDependencies().flatMap((workspace) => Object.keys(manifest(workspace).peerDependencies ?? {}));
		expect(declaredPeers.length).toBeGreaterThan(0);
		expect(instances.filter((instance) => instance.dependencyType === "peer")).toEqual([]);
	});
});

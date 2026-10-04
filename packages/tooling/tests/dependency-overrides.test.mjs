/**
 * Verifies the scoped `parent>uuid` overrides in pnpm-workspace.yaml against
 * the INSTALLED dependency tree: each parent was published against uuid ^9 and
 * is forced onto a newer major, so prove that what it actually loads is the
 * overridden version and that the call it makes (`require("uuid").v4()`) still
 * works. A future override bump that breaks the CJS `v4` export fails here
 * instead of at runtime inside firebase-admin.
 */
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
const PNPM_STORE_DIR = path.join(REPO_ROOT, "node_modules/.pnpm");
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
/** `  "parent>uuid": "11.1.1"` (quotes optional, trailing comment allowed). */
const UUID_OVERRIDE_PATTERN = /^\s+["']?([^"'\s>]+)>uuid["']?:\s*["']?([^"'\s#]+)["']?/gm;

function readUuidOverrides() {
	const workspaceYaml = readFileSync(path.join(REPO_ROOT, "pnpm-workspace.yaml"), "utf8");
	return [...workspaceYaml.matchAll(UUID_OVERRIDE_PATTERN)].map((match) => ({ parent: match[1], version: match[2] }));
}

/** Every installed copy of `packageName` (pnpm keeps one directory per version + peer set). */
function installedCopies(packageName) {
	const storePrefix = `${packageName.replace("/", "+")}@`;
	return readdirSync(PNPM_STORE_DIR)
		.filter((entry) => entry.startsWith(storePrefix))
		.map((entry) => path.join(PNPM_STORE_DIR, entry, "node_modules", packageName));
}

function readManifest(packageDir) {
	return JSON.parse(readFileSync(path.join(packageDir, "package.json"), "utf8"));
}

const overrides = readUuidOverrides();

describe("pnpm overrides: parent>uuid", () => {
	it("are declared (the parser below still matches pnpm-workspace.yaml)", () => {
		expect(overrides.map((override) => override.parent).sort()).toEqual(["gaxios", "google-gax", "teeny-request"]);
	});

	it.each(overrides)("$parent loads uuid $version and its CJS v4() still returns a v4 UUID", ({ parent, version }) => {
		const copiesUsingUuid = installedCopies(parent).filter((packageDir) => readManifest(packageDir).dependencies?.uuid !== undefined);
		expect(copiesUsingUuid.length).toBeGreaterThan(0);

		for (const packageDir of copiesUsingUuid) {
			const requireFromParent = createRequire(path.join(packageDir, "package.json"));
			const uuidManifestPath = requireFromParent.resolve("uuid/package.json");
			expect(readManifest(path.dirname(uuidManifestPath)).version).toBe(version);

			// The parents call `require("uuid").v4()` (CJS), so exercise exactly that.
			const uuid = requireFromParent("uuid");
			expect(uuid.v4()).toMatch(UUID_V4_PATTERN);
		}
	});
});

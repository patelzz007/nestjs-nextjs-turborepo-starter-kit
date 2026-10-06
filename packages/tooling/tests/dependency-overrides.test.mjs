/**
 * Verifies the scoped `parent>uuid` overrides in pnpm-workspace.yaml against
 * the INSTALLED dependency tree: each parent was published against uuid ^9 and
 * is forced onto a newer major, so prove that what it actually loads is the
 * overridden version and that the call it makes (`require("uuid").v4()`) still
 * works. A future override bump that breaks the CJS `v4` export fails here
 * instead of at runtime inside firebase-admin. The scoped `concurrently>shell-quote`
 * security override is checked the same way: concurrently loads the overridden
 * version and the one function it imports (`quote`) still quotes as it expects.
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
/** `  "concurrently>shell-quote": "1.12.0"` (quotes optional, trailing comment allowed). */
const SHELL_QUOTE_OVERRIDE_PATTERN = /^\s+["']?concurrently>shell-quote["']?:\s*["']?([^"'\s#]+)["']?/m;
const WORKSPACE_YAML = readFileSync(path.join(REPO_ROOT, "pnpm-workspace.yaml"), "utf8");

function readUuidOverrides() {
	return [...WORKSPACE_YAML.matchAll(UUID_OVERRIDE_PATTERN)].map((match) => ({ parent: match[1], version: match[2] }));
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
		expect(overrides.map((override) => override.parent).sort()).toEqual(["gaxios"]);
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

describe("pnpm overrides: concurrently>shell-quote", () => {
	const version = WORKSPACE_YAML.match(SHELL_QUOTE_OVERRIDE_PATTERN)?.[1];

	it("is declared (the parser below still matches pnpm-workspace.yaml)", () => {
		expect(version).toMatch(/^\d+\.\d+\.\d+$/);
	});

	it("concurrently loads the overridden shell-quote and its quote() still escapes shell metacharacters", () => {
		const copies = installedCopies("concurrently");
		expect(copies.length).toBeGreaterThan(0);

		for (const packageDir of copies) {
			const requireFromParent = createRequire(path.join(packageDir, "package.json"));
			const shellQuoteManifestPath = requireFromParent.resolve("shell-quote/package.json");
			expect(readManifest(path.dirname(shellQuoteManifestPath)).version).toBe(version);

			// concurrently does `import { quote } from "shell-quote"`, so exercise exactly that export.
			const { quote } = requireFromParent("shell-quote");
			// Same output as the 1.9.0 concurrently pins: spaces single-quoted, `$` backslash-escaped.
			expect(quote(["echo", "a b", "$HOME"])).toBe("echo 'a b' \\$HOME");
		}
	});
});

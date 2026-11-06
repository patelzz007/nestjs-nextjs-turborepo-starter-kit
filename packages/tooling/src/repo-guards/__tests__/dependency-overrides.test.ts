/**
 * Verifies the scoped `parent>uuid` overrides in pnpm-workspace.yaml against
 * the INSTALLED dependency tree: each parent was published against uuid ^9 and
 * is forced onto a newer major, so prove that what it actually loads is the
 * overridden version and that the call it makes (`require("uuid").v4()`) still
 * works. A future override bump that breaks the CJS `v4` export fails here
 * instead of at runtime inside firebase-admin. The scoped `concurrently>shell-quote`
 * security override is checked the same way: concurrently loads the overridden
 * version and the one function it imports (`quote`) still quotes as it expects. The scoped
 * `@expo/cli>zod` security override (zod 3 → 4): @expo/cli resolves the overridden version, and
 * none of its own code loads that copy (since 58.1.18 its DevTools schemas are plain JSON schemas
 * and its MCP integration takes zod from `expo-mcp`), so the major bump changes nothing it runs.
 * A release that starts loading its own zod again fails here, to be re-checked against zod 4.
 * The scoped `@firebase/firestore>@grpc/grpc-js` security override (~1.9 → 1.14): Firestore's own install
 * resolves the overridden version, its Node build still loads, and the four grpc-js calls it makes (`Metadata`,
 * `loadPackageDefinition`, `credentials.createSsl` / `createInsecure`) still work.
 */
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { moduleSchema, packageManifest } from "../../testing/manifests.ts";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../../../..");
const PNPM_STORE_DIR = path.join(REPO_ROOT, "node_modules/.pnpm");
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
/** `  "parent>uuid": "11.1.1"` (quotes optional, trailing comment allowed). */
const UUID_OVERRIDE_PATTERN = /^\s+["']?([^"'\s>]+)>uuid["']?:\s*["']?([^"'\s#]+)["']?/gm;
/** `  "concurrently>shell-quote": "1.12.0"` (quotes optional, trailing comment allowed). */
const SHELL_QUOTE_OVERRIDE_PATTERN = /^\s+["']?concurrently>shell-quote["']?:\s*["']?([^"'\s#]+)["']?/m;
/** `  "@expo/cli>zod": "4.6.7"` (quotes optional, trailing comment allowed). */
const EXPO_CLI_ZOD_OVERRIDE_PATTERN = /^\s+["']?@expo\/cli>zod["']?:\s*["']?([^"'\s#]+)["']?/m;
/** `  "@firebase/firestore>@grpc/grpc-js": "1.14.7"` (quotes optional, trailing comment allowed). */
const FIRESTORE_GRPC_OVERRIDE_PATTERN = /^\s+["']?@firebase\/firestore>@grpc\/grpc-js["']?:\s*["']?([^"'\s#]+)["']?/m;
const WORKSPACE_YAML = readFileSync(path.join(REPO_ROOT, "pnpm-workspace.yaml"), "utf8");

function readUuidOverrides(): { parent: string; version: string }[] {
	return [...WORKSPACE_YAML.matchAll(UUID_OVERRIDE_PATTERN)].map((match) => ({ parent: match.at(1) ?? "", version: match.at(2) ?? "" }));
}

/** Every installed copy of `packageName` (pnpm keeps one directory per version + peer set). */
function installedCopies(packageName: string): string[] {
	const storePrefix = `${packageName.replace("/", "+")}@`;
	return readdirSync(PNPM_STORE_DIR)
		.filter((entry) => entry.startsWith(storePrefix))
		.map((entry) => path.join(PNPM_STORE_DIR, entry, "node_modules", packageName));
}

/** What this test calls of `@grpc/grpc-js`. */
type GrpcModule = Record<"Metadata", new () => { set: (key: string, value: string) => void; get: (key: string) => string[] }> & {
	readonly credentials: { readonly createInsecure: () => object; readonly createSsl: () => object };
	readonly loadPackageDefinition: (definition: object) => object;
};

function readManifest(packageDir: string): ReturnType<typeof packageManifest> {
	return packageManifest(readFileSync(path.join(packageDir, "package.json"), "utf8"));
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
			const uuid = moduleSchema<{ readonly v4: () => string }>().parse(requireFromParent("uuid"));
			expect(uuid.v4()).toMatch(UUID_V4_PATTERN);
		}
	});
});

describe("pnpm overrides: concurrently>shell-quote", () => {
	const version = SHELL_QUOTE_OVERRIDE_PATTERN.exec(WORKSPACE_YAML)?.at(1);

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
			const { quote } = moduleSchema<{ readonly quote: (args: readonly string[]) => string }>().parse(requireFromParent("shell-quote"));
			// Same output as the 1.9.0 concurrently pins: spaces single-quoted, `$` backslash-escaped.
			expect(quote(["echo", "a b", "$HOME"])).toBe("echo 'a b' \\$HOME");
		}
	});
});

describe("pnpm overrides: @expo/cli>zod", () => {
	const version = EXPO_CLI_ZOD_OVERRIDE_PATTERN.exec(WORKSPACE_YAML)?.at(1);

	it("is declared (the parser below still matches pnpm-workspace.yaml)", () => {
		expect(version).toMatch(/^\d+\.\d+\.\d+$/);
	});

	it("@expo/cli resolves the overridden zod, and none of its own code loads that copy", () => {
		// The @expo/cli that `expo start` runs: resolved from the mobile app's `expo`, as expo resolves it
		// (a store scan would also find copies a past install left behind, outside the lockfile).
		const requireFromMobile = createRequire(path.join(REPO_ROOT, "apps/mobile/package.json"));
		const requireFromExpo = createRequire(requireFromMobile.resolve("expo/package.json"));
		const packageDir = path.dirname(requireFromExpo.resolve("@expo/cli/package.json"));
		const requireFromParent = createRequire(path.join(packageDir, "package.json"));
		expect(readManifest(path.dirname(requireFromParent.resolve("zod/package.json"))).version).toBe(version);

		// A plain `require("zod")` / `import … from "zod"` would load the overridden copy.
		const ownZodLoad = /\brequire\(\s*["']zod["']\s*\)|\bfrom\s+["']zod["']/u;
		const loaders = readdirSync(path.join(packageDir, "build"), { recursive: true, encoding: "utf8" })
			.filter((file) => file.endsWith(".js"))
			.filter((file) => ownZodLoad.test(readFileSync(path.join(packageDir, "build", file), "utf8")));
		expect(loaders).toEqual([]);
	});
});

describe("pnpm overrides: @firebase/firestore>@grpc/grpc-js", () => {
	const version = FIRESTORE_GRPC_OVERRIDE_PATTERN.exec(WORKSPACE_YAML)?.at(1);

	it("is declared", () => {
		expect(version).toMatch(/^\d+\.\d+\.\d+$/);
	});

	it("is what Firestore loads, and the grpc-js calls Firestore's Node build makes still work", () => {
		const copies = installedCopies("@firebase/firestore");
		expect(copies.length).toBeGreaterThan(0);
		for (const packageDir of copies) {
			const requireFromFirestore = createRequire(path.join(packageDir, "package.json"));
			expect(z.object({ version: z.string() }).parse(requireFromFirestore("@grpc/grpc-js/package.json")).version).toBe(version);
			expect(z.looseObject({}).parse(requireFromFirestore("@firebase/firestore")).getFirestore).toBeTypeOf("function");

			const grpc = moduleSchema<GrpcModule>().parse(requireFromFirestore("@grpc/grpc-js"));
			const metadata = new grpc.Metadata();
			metadata.set("x-goog-api-client", "gl-node");
			expect(metadata.get("x-goog-api-client")).toEqual(["gl-node"]);
			expect(grpc.credentials.createInsecure()).toBeTruthy();
			expect(grpc.credentials.createSsl()).toBeTruthy();
			expect(grpc.loadPackageDefinition({})).toEqual({});
		}
	});
});

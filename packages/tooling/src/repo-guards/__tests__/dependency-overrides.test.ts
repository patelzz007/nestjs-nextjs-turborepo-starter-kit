/**
 * Verifies the scoped `parent>uuid` overrides in pnpm-workspace.yaml against
 * the INSTALLED dependency tree: each parent was published against uuid ^9 and
 * is forced onto a newer major, so prove that what it actually loads is the
 * overridden version and that the call it makes (`require("uuid").v4()`) still
 * works. A future override bump that breaks the CJS `v4` export fails here
 * instead of at runtime inside firebase-admin. The scoped `@firebase/firestore>@grpc/grpc-js` security override (~1.9 → 1.14): Firestore's own install
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

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import manifest from "../package.json" with { type: "json" };

/**
 * The configs are JavaScript with hand-written declarations beside them, so a
 * new or renamed export must be declared too: TypeScript workspaces would
 * otherwise fail to import it (or import something that no longer exists).
 */

const PACKAGE_ROOT = new URL("../", import.meta.url);
const DECLARED_EXPORT = /^export declare (?:const|function) (?<name>[A-Za-z_$][\w$]*)/gmu;
const DEFAULT_EXPORT = /^export default /mu;

/** The names a declaration file declares (`default` for a default export). */
function declaredNames(declarationPath) {
	const source = readFileSync(new URL(declarationPath, PACKAGE_ROOT), "utf8");
	const names = [...source.matchAll(DECLARED_EXPORT)].map((match) => match.groups?.name ?? "");
	return DEFAULT_EXPORT.test(source) ? [...names, "default"] : names;
}

describe("every public entry point is declared, export for export", () => {
	it.each(Object.entries(manifest.exports))("%s", async (_entry, { types, default: modulePath }) => {
		const runtime = await import(new URL(modulePath, PACKAGE_ROOT).href);
		expect(declaredNames(types).sort()).toEqual(Object.keys(runtime).sort());
	});
});

// The edge modules run inside the apps' route proxies (`proxy.ts`): they must
// never pull a client module ("use client") or browser storage into the proxy
// bundle. This walks every relative import reachable from them.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const EDGE_DIR: string = dirname(fileURLToPath(import.meta.url));
const RELATIVE_IMPORT = /from\s+"(?<specifier>\.{1,2}\/[^"]+)"/g;
const SOURCE_EXTENSIONS: readonly string[] = [".ts", ".tsx"];

function resolveSource(fromFile: string, specifier: string): string {
	const base: string = resolve(dirname(fromFile), specifier);
	const found: string | undefined = SOURCE_EXTENSIONS.map((extension: string): string => `${base}${extension}`).find((candidate: string): boolean => existsSync(candidate));
	if (found !== undefined) return found;
	throw new Error(`Cannot resolve ${specifier} from ${fromFile}`);
}

/** Every source file reachable through relative imports from `entry`. */
function reachableSources(entry: string, seen: Set<string> = new Set<string>()): Set<string> {
	if (seen.has(entry)) return seen;
	seen.add(entry);
	for (const match of readFileSync(entry, "utf8").matchAll(RELATIVE_IMPORT)) {
		const specifier: string | undefined = match.groups?.specifier;
		if (specifier !== undefined) reachableSources(resolveSource(entry, specifier), seen);
	}
	return seen;
}

const EDGE_ENTRIES: readonly string[] = readdirSync(EDGE_DIR)
	.filter((name: string): boolean => name.endsWith(".ts") && !name.endsWith(".test.ts"))
	.map((name: string): string => resolve(EDGE_DIR, name));

describe("edge modules (route proxies)", () => {
	it.each(EDGE_ENTRIES)("%s reaches no client module and no browser storage", (entry: string) => {
		for (const source of reachableSources(entry)) {
			const text: string = readFileSync(source, "utf8");
			expect(text.startsWith('"use client"'), `${source} is a client module`).toBe(false);
			expect(/\b(sessionStorage|localStorage)\b/.test(text), `${source} touches browser storage`).toBe(false);
		}
	});
});

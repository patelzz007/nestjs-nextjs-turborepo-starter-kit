// The base RLS helpers (00-app-helpers.sql) and the generated scopes function don't pin a search_path (a
// SET clause would stop the planner inlining them into the policies that call them per row), so when one
// calls another it must name it `public.app_…`: an unqualified call resolves through the CALLER's search
// path and fails inside a function pinned to `pg_catalog` (the DataChangeGroup trigger, 2026-11-02).
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const RLS_DIR = join(import.meta.dirname, "..");
const UNPINNED_FILES = ["00-app-helpers.sql", "00-system-operation-scopes.sql"];

/** The SQL without its `--` comments. */
function withoutComments(sql: string): string {
	return sql.replace(/--[^\n]*/gu, "");
}

/** The SQL between each `AS $$` and its closing `$$`: the function bodies. */
function functionBodiesOf(sql: string): readonly string[] {
	return [...sql.matchAll(/AS \$\$(?<body>[\s\S]*?)\$\$/gu)].map((match: RegExpExecArray): string => match.groups?.body ?? "");
}

describe("unpinned RLS helpers", () => {
	it.each(UNPINNED_FILES)("%s calls other app_ helpers only schema-qualified", (file: string) => {
		const bodies = functionBodiesOf(withoutComments(readFileSync(join(RLS_DIR, file), "utf8")));
		expect(bodies.length).toBeGreaterThan(0);
		for (const body of bodies) {
			expect(body).not.toMatch(/(?<!public\.)\bapp_[a-z_]+\(/u);
		}
	});

	it("are not pinned with SET search_path, so they stay inlinable", () => {
		for (const file of UNPINNED_FILES) {
			expect(withoutComments(readFileSync(join(RLS_DIR, file), "utf8"))).not.toMatch(/SET search_path/u);
		}
	});
});

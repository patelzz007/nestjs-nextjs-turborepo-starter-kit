// The session primitives (generator/functions/session.ts) and the generated scopes function don't pin a
// search_path (a SET clause would stop the planner inlining them into the policies that call them per row),
// so when one calls another it must name it `public.app_…`: an unqualified call resolves through the
// CALLER's search path and fails inside a function pinned to `pg_catalog` (the DataChangeGroup trigger,
// 2026-11-02).
import { describe, expect, it } from "vitest";

import { SESSION_FUNCTIONS } from "../generator/functions/session";
import { buildSystemOperationScopesSql } from "../system-operation-scopes";

const UNPINNED: readonly { readonly name: string; readonly sql: string }[] = [
	...SESSION_FUNCTIONS.map((fn) => ({ name: fn.name, sql: fn.definition })),
	{ name: "app_rls_bypass_on", sql: buildSystemOperationScopesSql({ "outbox.publish": { scope: { kind: "tables", tables: ["OutboxEvent"] } } }, new Set(["OutboxEvent"])) },
];

/** The SQL without its `--` comments. */
function withoutComments(sql: string): string {
	return sql.replace(/--[^\n]*/gu, "");
}

/** The SQL between each `AS $$` and its closing `$$`: the function bodies. */
function functionBodiesOf(sql: string): readonly string[] {
	return [...sql.matchAll(/AS \$\$(?<body>[\s\S]*?)\$\$/gu)].map((match: RegExpExecArray): string => match.groups?.body ?? "");
}

describe("unpinned RLS helpers", () => {
	it.each(UNPINNED)("$name calls other app_ helpers only schema-qualified", ({ sql }) => {
		const bodies = functionBodiesOf(withoutComments(sql));
		expect(bodies.length).toBeGreaterThan(0);
		for (const body of bodies) {
			expect(body).not.toMatch(/(?<!public\.)\bapp_[a-z_]+\(/u);
		}
	});

	it("are not pinned with SET search_path, so they stay inlinable", () => {
		for (const { sql } of UNPINNED) {
			expect(withoutComments(sql)).not.toMatch(/SET search_path/u);
		}
	});
});

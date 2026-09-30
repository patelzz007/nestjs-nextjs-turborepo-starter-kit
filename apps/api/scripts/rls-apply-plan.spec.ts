import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { RLS_APPLY_ORDER, assertPlanMatchesDisk, assertRlsHelperDependencies, buildRlsApplyPlan, type RlsPlanFile } from "./rls-apply-plan";

const apiDir = resolve(import.meta.dirname, "..");

function planFile(path: string, sql: string): RlsPlanFile {
	return { path, sql };
}

describe("RLS apply plan", () => {
	it("registers the RLS files in canonical layer order", () => {
		expect(RLS_APPLY_ORDER).toEqual(["prisma/rls/00-app-helpers.sql", "prisma/rls/01-acl-location-access.sql", "prisma/rls.sql", "prisma/rls/99-app-runtime-grants.sql"]);
	});

	it("accepts the shipped files: disk matches the plan and every helper is defined before use", () => {
		expect((): string[] => buildRlsApplyPlan(apiDir)).not.toThrow();
		expect(buildRlsApplyPlan(apiDir)).toHaveLength(RLS_APPLY_ORDER.length);
	});

	it("rejects a helper used before its defining file — the fresh-database bug", () => {
		const plan: RlsPlanFile[] = [
			planFile("a.sql", "CREATE POLICY p ON t USING (app_owns(id));"),
			planFile("b.sql", "CREATE FUNCTION app_owns(id text) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;"),
		];
		expect((): void => assertRlsHelperDependencies(plan)).toThrowError(/app_owns\(\).*before it is defined/s);
	});

	it("accepts the same files once the helper-defining layer comes first", () => {
		const plan: RlsPlanFile[] = [
			planFile("a.sql", "CREATE FUNCTION app_owns(id text) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;"),
			planFile("b.sql", "CREATE POLICY p ON t USING (app_owns(id));"),
		];
		expect((): void => assertRlsHelperDependencies(plan)).not.toThrow();
	});

	it("rejects a helper defined in two different files", () => {
		const plan: RlsPlanFile[] = [
			planFile("a.sql", "CREATE FUNCTION app_owns(id text) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;"),
			planFile("b.sql", "CREATE OR REPLACE FUNCTION app_owns(id text) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;"),
		];
		expect((): void => assertRlsHelperDependencies(plan)).toThrowError(/app_owns\(\).*exactly one file/s);
	});

	it("ignores helper mentions inside SQL comments", () => {
		const plan: RlsPlanFile[] = [planFile("notes.sql", "-- docs mention app_owns(id) and app_rls_bypass()\nCREATE TABLE t (id text);")];
		expect((): void => assertRlsHelperDependencies(plan)).not.toThrow();
	});

	it("rejects files on disk that are not registered in RLS_APPLY_ORDER", () => {
		expect((): void => assertPlanMatchesDisk(["a.sql", "b.sql"], ["a.sql", "b.sql", "c.sql"])).toThrowError(/files on disk are missing from RLS_APPLY_ORDER: c\.sql/);
	});

	it("rejects plan entries whose files are missing from disk", () => {
		expect((): void => assertPlanMatchesDisk(["a.sql", "b.sql"], ["b.sql"])).toThrowError(/lists files that do not exist: a\.sql/);
	});

	it("accepts a plan that exactly matches disk", () => {
		expect((): void => assertPlanMatchesDisk(["a.sql", "b.sql"], ["a.sql", "b.sql"])).not.toThrow();
	});
});

import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { RLS_APPLY_ORDER, assertPlanMatchesDisk, assertRlsHelperDependencies, assertRlsRoleDependencies, buildRlsApplyPlan, type RlsPlanFile } from "./rls-apply-plan.js";

const apiDir = resolve(import.meta.dirname, "..");

function planFile(path: string, sql: string): RlsPlanFile {
	return { path, sql };
}

describe("RLS apply plan", () => {
	it("registers the RLS files in canonical layer order", () => {
		expect(RLS_APPLY_ORDER).toEqual([
			"prisma/rls/00-app-helpers.sql",
			"prisma/rls/01-acl-location-access.sql",
			"prisma/rls.sql",
			"prisma/rls/40-api-key-principal.sql",
			"prisma/rls/90-analytics-consumer.sql",
			"prisma/rls/99-app-runtime-grants.sql",
		]);
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
		expect((): void => {
			assertRlsHelperDependencies(plan);
		}).toThrow(/app_owns\(\).*before it is defined/s);
	});

	it("accepts the same files once the helper-defining layer comes first", () => {
		const plan: RlsPlanFile[] = [
			planFile("a.sql", "CREATE FUNCTION app_owns(id text) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;"),
			planFile("b.sql", "CREATE POLICY p ON t USING (app_owns(id));"),
		];
		expect((): void => {
			assertRlsHelperDependencies(plan);
		}).not.toThrow();
	});

	it("rejects a helper defined in two different files", () => {
		const plan: RlsPlanFile[] = [
			planFile("a.sql", "CREATE FUNCTION app_owns(id text) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;"),
			planFile("b.sql", "CREATE OR REPLACE FUNCTION app_owns(id text) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;"),
		];
		expect((): void => {
			assertRlsHelperDependencies(plan);
		}).toThrow(/app_owns\(\).*exactly one file/s);
	});

	it("ignores helper mentions inside SQL comments", () => {
		const plan: RlsPlanFile[] = [planFile("notes.sql", "-- docs mention app_owns(id) and app_rls_bypass()\nCREATE TABLE t (id text);")];
		expect((): void => {
			assertRlsHelperDependencies(plan);
		}).not.toThrow();
	});

	it("rejects files on disk that are not registered in RLS_APPLY_ORDER", () => {
		expect((): void => {
			assertPlanMatchesDisk(["a.sql", "b.sql"], ["a.sql", "b.sql", "c.sql"]);
		}).toThrow(/files on disk are missing from RLS_APPLY_ORDER: c\.sql/);
	});

	it("rejects plan entries whose files are missing from disk", () => {
		expect((): void => {
			assertPlanMatchesDisk(["a.sql", "b.sql"], ["b.sql"]);
		}).toThrow(/lists files that do not exist: a\.sql/);
	});

	it("accepts a plan that exactly matches disk", () => {
		expect((): void => {
			assertPlanMatchesDisk(["a.sql", "b.sql"], ["a.sql", "b.sql"]);
		}).not.toThrow();
	});

	it("rejects a role granted to before the file that creates it — the fresh-cluster bug", () => {
		const plan: RlsPlanFile[] = [planFile("a.sql", "GRANT EXECUTE ON FUNCTION f() TO app_runtime;"), planFile("b.sql", "CREATE ROLE app_runtime NOLOGIN;")];
		expect((): void => {
			assertRlsRoleDependencies(plan);
		}).toThrow(/uses role app_runtime at line 1 before it is created/);
	});

	it("accepts a guarded CREATE ROLE whose existence check quotes the role name", () => {
		const plan: RlsPlanFile[] = [
			planFile(
				"a.sql",
				"DO $$\nBEGIN\n  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN\n    CREATE ROLE app_runtime NOLOGIN;\n  END IF;\nEND $$;\nGRANT app_runtime TO CURRENT_USER;",
			),
			planFile("b.sql", "GRANT USAGE ON SCHEMA public TO app_runtime;"),
		];
		expect((): void => {
			assertRlsRoleDependencies(plan);
		}).not.toThrow();
	});

	it("rejects a role created in two different files", () => {
		const plan: RlsPlanFile[] = [planFile("a.sql", "CREATE ROLE app_runtime NOLOGIN;"), planFile("b.sql", "CREATE ROLE app_runtime NOLOGIN;")];
		expect((): void => {
			assertRlsRoleDependencies(plan);
		}).toThrow(/creates role app_runtime — already created in a\.sql/);
	});

	it("ignores role mentions in comments and inside longer identifiers", () => {
		const plan: RlsPlanFile[] = [
			planFile("a.sql", "-- grants to app_runtime later\nCREATE TABLE app_runtime_log (id text);"),
			planFile("b.sql", "CREATE ROLE app_runtime NOLOGIN;"),
		];
		expect((): void => {
			assertRlsRoleDependencies(plan);
		}).not.toThrow();
	});
});

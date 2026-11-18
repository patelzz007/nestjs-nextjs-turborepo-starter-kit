import { describe, expect, it } from "vitest";

import {
	ACTOR_SETTING,
	buildRowAuditSql,
	CURRENT_ACTOR_FUNCTION,
	planRowAudit,
	ROW_AUDIT_COLUMNS,
	ROW_AUDIT_FUNCTION,
	ROW_AUDIT_TRIGGER,
	RowAuditPlanError,
	type RowAuditCatalogTable,
} from "../row-audit";

const BASE_COLUMNS: readonly string[] = ["id", "createdAt", ...ROW_AUDIT_COLUMNS];

function table(name: string, columns: readonly string[] = BASE_COLUMNS): RowAuditCatalogTable {
	return { name, columns };
}

describe("planRowAudit", () => {
	it("audits every table with the base columns, sorted by name", () => {
		expect(planRowAudit([table("User"), table("AuditLog")])).toEqual({ audited: ["AuditLog", "User"], missing: [] });
	});

	it("reports a table missing base columns instead of auditing it, naming the columns", () => {
		const plan = planRowAudit([table("Loose", ["id", "createdAt", "updatedAt", "isDeleted"])]);

		expect(plan.audited).toEqual([]);
		expect(plan.missing).toEqual([{ table: "Loose", columns: ["createdBy", "updatedBy", "deletedAt", "deletedBy"] }]);
	});

	it("never audits Prisma's bookkeeping table", () => {
		expect(planRowAudit([table("_prisma_migrations", ["id", "checksum"])])).toEqual({ audited: [], missing: [] });
	});
});

describe("buildRowAuditSql", () => {
	it("defines the actor and trigger functions with a pinned search path, then one trigger per audited table", () => {
		const sql = buildRowAuditSql({ audited: ["AuditLog", "User"], missing: [] });

		expect(sql).toContain(`CREATE OR REPLACE FUNCTION public.${CURRENT_ACTOR_FUNCTION}() RETURNS text`);
		expect(sql).toContain(`CREATE OR REPLACE FUNCTION public.${ROW_AUDIT_FUNCTION}() RETURNS trigger`);
		expect(sql.match(/SET search_path = public/g)).toHaveLength(2);
		expect(sql).toContain(`current_setting('${ACTOR_SETTING}', true)`);
		expect(sql).toContain(`CREATE TRIGGER ${ROW_AUDIT_TRIGGER} BEFORE INSERT OR UPDATE ON public."AuditLog"`);
		expect(sql).toContain(`CREATE TRIGGER ${ROW_AUDIT_TRIGGER} BEFORE INSERT OR UPDATE ON public."User"`);
		expect(sql.indexOf(`DROP TRIGGER IF EXISTS ${ROW_AUDIT_TRIGGER} ON public."User"`)).toBeLessThan(sql.indexOf('BEFORE INSERT OR UPDATE ON public."User"'));
	});

	it("never overwrites a value the statement supplied, and keeps the soft-delete columns coherent", () => {
		const sql = buildRowAuditSql({ audited: [], missing: [] });

		expect(sql).toContain('NEW."createdBy" := COALESCE(NEW."createdBy", actor);');
		expect(sql).toContain('IF NEW."updatedAt" IS NOT DISTINCT FROM OLD."updatedAt" THEN');
		expect(sql).toContain('NEW."deletedAt" := COALESCE(NEW."deletedAt", now_ms);');
		expect(sql).toContain('NEW."deletedBy" := COALESCE(NEW."deletedBy", actor);');
	});

	it("refuses a table name that is not safe to interpolate", () => {
		expect((): string => buildRowAuditSql({ audited: ['User"; DROP TABLE x; --'], missing: [] })).toThrow(RowAuditPlanError);
	});
});

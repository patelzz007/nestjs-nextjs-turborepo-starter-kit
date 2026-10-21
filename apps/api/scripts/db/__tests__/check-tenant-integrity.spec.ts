import { describe, expect, it } from "vitest";

import { TENANT_INTEGRITY_RELATIONS, type TenantIntegrityRelation } from "../../../src/platform/infrastructure/tenancy/tenant-integrity";
import {
	checkTenantIntegrity,
	formatIntegrityReport,
	integrityExitCode,
	UnsafeIntegrityIdentifierError,
	violationCountSql,
	type IntegrityCountStore,
} from "../check-tenant-integrity";

const API_KEY_LOCATION: TenantIntegrityRelation = { child: "TenantApiKey", foreignKey: "locationId", parent: "Location" };

function storeWith(violations: ReadonlyMap<string, number>): IntegrityCountStore {
	return { count: (relation): Promise<number> => Promise.resolve(violations.get(`${relation.child}.${relation.foreignKey}`) ?? 0) };
}

describe("check-tenant-integrity", () => {
	it("counts child rows whose parent belongs to another tenant, skipping a null foreign key", () => {
		expect(violationCountSql(API_KEY_LOCATION)).toBe(
			'SELECT count(*)::int AS violations FROM public."TenantApiKey" c JOIN public."Location" p ON p.id = c."locationId" WHERE c."locationId" IS NOT NULL AND p."tenantId" <> c."tenantId"',
		);
	});

	it("refuses an identifier that is not safe to quote", () => {
		expect((): string => violationCountSql({ child: 'Store"; DROP TABLE x; --', foreignKey: "locationId", parent: "Location" })).toThrow(UnsafeIntegrityIdentifierError);
	});

	it("checks exactly the fourteen §7 relations", async () => {
		const counts = await checkTenantIntegrity(storeWith(new Map()));

		expect(counts).toHaveLength(14);
		expect(counts.map((count) => count.relation)).toEqual(TENANT_INTEGRITY_RELATIONS);
		expect(integrityExitCode(counts)).toBe(0);
		expect(formatIntegrityReport(counts)).toContain("No cross-tenant rows: every composite tenant foreign key holds.");
	});

	it("exits 1 and names the relation when any row crosses tenants, and never fixes it", async () => {
		const counts = await checkTenantIntegrity(storeWith(new Map([["TenantApiKey.locationId", 2]])));

		expect(integrityExitCode(counts)).toBe(1);
		const report = formatIntegrityReport(counts);
		expect(report).toContain("FAIL  TenantApiKey(tenantId, locationId) -> Location(tenantId, id): 2");
		expect(report).toContain("2 cross-tenant row(s). Do not add the foreign keys; report to a human.");
	});
});

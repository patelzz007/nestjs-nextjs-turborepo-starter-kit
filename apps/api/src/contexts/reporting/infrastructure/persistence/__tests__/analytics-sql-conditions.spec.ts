import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { isArrayValue, isBooleanPrimitive, isNumberPrimitive, isStringPrimitive } from "@workspace/shared";

import { ALL_ANALYTICS_LOCATIONS, selectedAnalyticsLocations, type AnalyticsScope } from "../../../domain/value-objects/analytics-scope.value-object";
import { allOf, claimConditions, claimSource, redemptionConditions, salesConditions, withinRange } from "../analytics-sql-conditions";

const ORG = "org-1";
const STORE = "store-1";

function sqlOf(conditions: Parameters<typeof allOf>[0]): { readonly text: string; readonly values: readonly (string | number | boolean | null | readonly string[])[] } {
	const sql = allOf(conditions);
	return {
		text: sql.sql,
		values: sql.values.map((value) =>
			isArrayValue(value) ? value.map(String) : isStringPrimitive(value) || isNumberPrimitive(value) || isBooleanPrimitive(value) ? value : null,
		),
	};
}

describe("analytics scope filters", () => {
	const allStores: AnalyticsScope = { kind: "organization", organizationId: ORG, locationScope: ALL_ANALYTICS_LOCATIONS };
	const oneStore: AnalyticsScope = { kind: "organization", organizationId: ORG, locationScope: selectedAnalyticsLocations([STORE]) };
	const noStores: AnalyticsScope = { kind: "organization", organizationId: ORG, locationScope: selectedAnalyticsLocations([]) };

	it("limits a store-scoped merchant's bills and redemptions to its stores, an all-stores one only to the organization", () => {
		expect(sqlOf(salesConditions(allStores)).text).not.toContain('"locationId"');
		const sales = sqlOf(salesConditions(oneStore));
		expect(sales.text).toContain('s."locationId" = ANY(');
		expect(sales.values).toEqual(expect.arrayContaining([ORG, [STORE]]));
		const redemptions = sqlOf(redemptionConditions(oneStore));
		expect(redemptions.text).toContain('rd."locationId" = ANY(');
		expect(redemptions.values).toEqual(expect.arrayContaining([ORG, [STORE]]));
	});

	it("keeps an empty store list an empty filter (matches nothing), never 'no filter'", () => {
		const sales = sqlOf(salesConditions(noStores));
		expect(sales.text).toContain('s."locationId" = ANY(');
		expect(sales.values).toContainEqual([]);
	});

	it("counts a store-scoped merchant's claims only for rewards offered at its stores (or everywhere)", () => {
		const claims = sqlOf(claimConditions(oneStore));
		expect(claims.text).toContain("r.\"locationScopeType\" = 'ALL_LOCATIONS'");
		expect(claims.text).toContain('rls."locationId" = ANY(');
		expect(claims.values).toEqual(expect.arrayContaining([ORG, [STORE]]));
		expect(sqlOf(claimConditions(allStores)).text).not.toContain('"RewardLocationScope"');
	});

	it("scopes a customer to their own rows and reads claims without the reward", () => {
		const customer: AnalyticsScope = { kind: "customer", userId: "user-1" };
		const sales = sqlOf(salesConditions(customer));
		expect(sales.text).toContain('s."userId" =');
		expect(sales.values).toContain("user-1");
		expect(sqlOf(claimConditions(customer)).text).toContain('c."userId" =');
		expect(claimSource(customer).sql).not.toContain('JOIN "Reward"');
		expect(claimSource(allStores).sql).toContain('JOIN "Reward"');
	});

	it("filters live rows only, in the platform currency, over a half-open range", () => {
		const platform = sqlOf(salesConditions({ kind: "platform" }));
		expect(platform.text).toContain('s."isDeleted" = false');
		expect(platform.values).toContain("MYR");
		const range = withinRange(Prisma.sql`s."paidAt"`, { fromMs: 10, toMs: 20 });
		expect(range.text).toBe('s."paidAt" >= $1::bigint AND s."paidAt" < $2::bigint');
		expect(range.values).toEqual([10, 20]);
	});
});

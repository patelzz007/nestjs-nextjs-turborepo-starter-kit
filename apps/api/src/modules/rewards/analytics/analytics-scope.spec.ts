import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { isArrayValue, isBooleanPrimitive, isNumberPrimitive, isStringPrimitive } from "@workspace/shared";

import { ALL_LOCATIONS_SCOPE, selectedLocationsScope } from "../types/merchant-location-scope";
import { allOf, claimConditions, claimSource, redemptionConditions, salesConditions, withinRange, type AnalyticsScope } from "./analytics-scope";

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
	const allStores: AnalyticsScope = { kind: "organization", organizationId: ORG, locationScope: ALL_LOCATIONS_SCOPE };
	const oneStore: AnalyticsScope = { kind: "organization", organizationId: ORG, locationScope: selectedLocationsScope([STORE]) };
	const noStores: AnalyticsScope = { kind: "organization", organizationId: ORG, locationScope: selectedLocationsScope([]) };

	it("limits a store-scoped merchant's bills and redemptions to its stores, an all-stores one only to the organization", () => {
		expect(sqlOf(salesConditions(allStores)).text).not.toContain("location_id");
		const sales = sqlOf(salesConditions(oneStore));
		expect(sales.text).toContain("s.location_id = ANY(");
		expect(sales.values).toEqual(expect.arrayContaining([ORG, [STORE]]));
		const redemptions = sqlOf(redemptionConditions(oneStore));
		expect(redemptions.text).toContain("rd.location_id = ANY(");
		expect(redemptions.values).toEqual(expect.arrayContaining([ORG, [STORE]]));
	});

	it("keeps an empty store list an empty filter (matches nothing), never 'no filter'", () => {
		const sales = sqlOf(salesConditions(noStores));
		expect(sales.text).toContain("s.location_id = ANY(");
		expect(sales.values).toContainEqual([]);
	});

	it("counts a store-scoped merchant's claims only for rewards offered at its stores (or everywhere)", () => {
		const claims = sqlOf(claimConditions(oneStore));
		expect(claims.text).toContain("r.location_scope_type = 'ALL_LOCATIONS'");
		expect(claims.text).toContain("rls.location_id = ANY(");
		expect(claims.values).toEqual(expect.arrayContaining([ORG, [STORE]]));
		expect(sqlOf(claimConditions(allStores)).text).not.toContain("reward_location_scopes");
	});

	it("scopes a customer to their own rows and reads claims without the reward", () => {
		const customer: AnalyticsScope = { kind: "customer", userId: "user-1" };
		const sales = sqlOf(salesConditions(customer));
		expect(sales.text).toContain("s.user_id =");
		expect(sales.values).toContain("user-1");
		expect(sqlOf(claimConditions(customer)).text).toContain("c.user_id =");
		expect(claimSource(customer).sql).not.toContain("JOIN rewards");
		expect(claimSource(allStores).sql).toContain("JOIN rewards");
	});

	it("filters live rows only, in the platform currency, over a half-open range", () => {
		const platform = sqlOf(salesConditions({ kind: "platform" }));
		expect(platform.text).toContain("s.is_deleted = false");
		expect(platform.values).toContain("MYR");
		const range = withinRange(Prisma.sql`s.paid_at`, { fromMs: 10, toMs: 20 });
		expect(range.text).toBe("s.paid_at >= $1::bigint AND s.paid_at < $2::bigint");
		expect(range.values).toEqual([10, 20]);
	});
});

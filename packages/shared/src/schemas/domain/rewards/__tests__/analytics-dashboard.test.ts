import { describe, expect, it } from "vitest";

import { ClaimStatusBreakdownSchema, CustomerDashboardTotalsSchema } from "./analytics-dashboard";

const ZERO = { value: 0, previous: 0, change: 0, changePercent: null };
const BASE_TOTALS = { spentMinor: ZERO, visits: ZERO, averageBillMinor: ZERO, claims: ZERO, redemptions: ZERO, conversionRate: ZERO, merchants: ZERO };

describe("CustomerDashboardTotalsSchema", () => {
	it("requires the customer's referral activity next to the spending and claim totals", () => {
		expect(CustomerDashboardTotalsSchema.safeParse(BASE_TOTALS).success).toBe(false);
		expect(CustomerDashboardTotalsSchema.safeParse({ ...BASE_TOTALS, referralsSent: ZERO, referralsCredited: ZERO, referralRewardsEarned: ZERO }).success).toBe(true);
	});
});

describe("ClaimStatusBreakdownSchema", () => {
	it("accepts every claim status with a non-negative whole count", () => {
		expect(ClaimStatusBreakdownSchema.safeParse({ status: "EXPIRED", claims: 2 }).success).toBe(true);
		expect(ClaimStatusBreakdownSchema.safeParse({ status: "CANCELLED", claims: 2 }).success).toBe(false);
		expect(ClaimStatusBreakdownSchema.safeParse({ status: "PENDING", claims: -1 }).success).toBe(false);
	});
});

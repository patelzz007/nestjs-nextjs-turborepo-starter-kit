import { describe, expect, it } from "vitest";

import { describeRateLimitAllowance, overrideAllowance, RATE_LIMIT_WEEK_MS, SetTenantRateLimitOverrideSchema } from "../traffic-and-cache";

const TENANT = "0193f2c4-0000-7000-8000-0000000000d1";
const EXPIRES = 1_800_000_000_000;
const REASON = "Black Friday campaign traffic";

describe("tenant rate-limit overrides", () => {
	it("stores traffic as a burst over the time the rate takes to refill it", () => {
		const input = SetTenantRateLimitOverrideSchema.parse({
			tenantId: TENANT,
			policyName: "TENANT_TRAFFIC",
			ratePerSecond: 50,
			burst: 200,
			reason: REASON,
			expiresAt: EXPIRES,
		});

		expect(overrideAllowance(input)).toEqual({ limit: 200, windowMs: 4_000 });
		expect(describeRateLimitAllowance("TENANT_TRAFFIC", overrideAllowance(input))).toBe("50/s, burst 200");
	});

	it("stores the broadcast allowance per week", () => {
		const input = SetTenantRateLimitOverrideSchema.parse({ tenantId: TENANT, policyName: "TENANT_BROADCASTS", perWeek: 8, reason: REASON, expiresAt: EXPIRES });

		expect(overrideAllowance(input)).toEqual({ limit: 8, windowMs: RATE_LIMIT_WEEK_MS });
		expect(describeRateLimitAllowance("TENANT_BROADCASTS", overrideAllowance(input))).toBe("8 per week");
	});

	it("takes each policy in its own units only, and a burst of at least one second's rate", () => {
		expect(
			SetTenantRateLimitOverrideSchema.safeParse({ tenantId: TENANT, policyName: "TENANT_BROADCASTS", ratePerSecond: 5, burst: 5, reason: REASON, expiresAt: EXPIRES })
				.success,
		).toBe(false);
		expect(SetTenantRateLimitOverrideSchema.safeParse({ tenantId: TENANT, policyName: "API_KEY_TRAFFIC", perWeek: 5, reason: REASON, expiresAt: EXPIRES }).success).toBe(
			false,
		);
		expect(
			SetTenantRateLimitOverrideSchema.safeParse({ tenantId: TENANT, policyName: "API_KEY_TRAFFIC", ratePerSecond: 50, burst: 10, reason: REASON, expiresAt: EXPIRES })
				.success,
		).toBe(false);
		expect(
			SetTenantRateLimitOverrideSchema.safeParse({ tenantId: TENANT, policyName: "API_KEY_TRAFFIC", ratePerSecond: 50, burst: 100, reason: "short", expiresAt: EXPIRES })
				.success,
		).toBe(false);
	});
});

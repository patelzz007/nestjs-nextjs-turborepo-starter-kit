import { describe, expect, it } from "vitest";

import { ALLOW_POLICY_DROPS_FLAG, policyDropsAllowed } from "../apply";

describe("policyDropsAllowed", () => {
	it("always allows dropping undeclared policies outside production", () => {
		expect(policyDropsAllowed([], undefined)).toBe(true);
		expect(policyDropsAllowed([], "development")).toBe(true);
		expect(policyDropsAllowed([], "test")).toBe(true);
	});

	it("requires the explicit flag in production", () => {
		expect(policyDropsAllowed([], "production")).toBe(false);
		expect(policyDropsAllowed(["--verbose"], "production")).toBe(false);
		expect(policyDropsAllowed([ALLOW_POLICY_DROPS_FLAG], "production")).toBe(true);
	});
});

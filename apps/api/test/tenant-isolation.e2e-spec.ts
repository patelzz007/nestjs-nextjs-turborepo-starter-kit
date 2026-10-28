import { describe, expect, it } from "vitest";

import { isAllowlistedSystemOperation } from "../src/prisma/system-operation.registry";

/**
 * Layered isolation checks — extend with live DB two-tenant tests when DATABASE_URL is available.
 */
describe("tenant isolation primitives", () => {
	it("rejects unknown system operations", () => {
		expect(isAllowlistedSystemOperation("arbitrary.bypass")).toBe(false);
		expect(isAllowlistedSystemOperation("tenant.enumerate")).toBe(true);
	});
});

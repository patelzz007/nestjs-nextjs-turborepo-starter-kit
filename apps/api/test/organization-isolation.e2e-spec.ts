import { describe, expect, it } from "vitest";

import { isAllowlistedSystemOperation } from "../src/prisma/system-operation.registry";
import { PolicyTemplateCompiler } from "../src/contexts/authorization/infrastructure/cedar/policy-template.compiler";

/**
 * Layered isolation checks — extend with live DB two-tenant tests when DATABASE_URL is available.
 */
describe("organization isolation primitives", () => {
	it("rejects unknown system operations", () => {
		expect(isAllowlistedSystemOperation("arbitrary.bypass")).toBe(false);
		expect(isAllowlistedSystemOperation("tenant.enumerate")).toBe(true);
	});

	it("scopes SQL predicates to organization", () => {
		const compiler = new PolicyTemplateCompiler();
		const organizationId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
		const compiled = compiler.compile({ templateId: "tenant.location_scope_read", parameters: { requireLocationScope: true } }, organizationId);
		expect(compiled.sqlPredicate).toBe(`"organizationId" = '${organizationId}' AND ("locationId" IS NULL OR "locationId" = ANY($locationIds))`);
	});
});

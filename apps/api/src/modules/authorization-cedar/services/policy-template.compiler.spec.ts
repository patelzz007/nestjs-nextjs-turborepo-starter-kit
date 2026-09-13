import { describe, expect, it } from "vitest";

import { PolicyTemplateCompiler } from "./policy-template.compiler";

describe("PolicyTemplateCompiler", () => {
	const compiler = new PolicyTemplateCompiler();

	it("compiles tenant role capability template", () => {
		const result = compiler.compile(
			{ templateId: "tenant.role_capability", parameters: { allowedRoles: ["OWNER", "ADMIN"] } },
			"org-123",
		);
		expect(result.cedarSource).toContain("permit");
		expect(result.sqlPredicate).toBe(`"organization_id" = 'org-123'`);
	});

	it("compiles platform guardrail forbid rules", () => {
		const result = compiler.compile({ templateId: "platform.guardrail.no_escalation", parameters: {} }, null);
		expect(result.cedarSource).toContain("forbid");
		expect(result.cedarSource).toContain("removeLastOwner");
	});
});

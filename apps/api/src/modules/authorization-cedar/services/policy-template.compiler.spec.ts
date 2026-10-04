import { describe, expect, it } from "vitest";

import { PolicyTemplateCompiler, PolicyTemplateError } from "./policy-template.compiler";

describe("PolicyTemplateCompiler", () => {
	const compiler = new PolicyTemplateCompiler();

	it("compiles tenant role capability template", () => {
		const result = compiler.compile({ templateId: "tenant.role_capability", parameters: { allowedRoles: ["OWNER", "ADMIN"] } }, "org-123");
		expect(result.cedarSource).toContain("permit");
		expect(result.sqlPredicate).toBe(`"organization_id" = 'org-123'`);
	});

	it("compiles platform guardrail forbid rules", () => {
		const result = compiler.compile({ templateId: "platform.guardrail.no_escalation", parameters: {} }, null);
		expect(result.cedarSource).toContain("forbid");
		expect(result.cedarSource).toContain("removeLastOwner");
	});

	it("rejects an unknown template instead of compiling a permit-all policy", () => {
		expect(() => compiler.compile({ templateId: "tenant.permit_everything", parameters: {} }, "org-123")).toThrow(PolicyTemplateError);
	});

	it("never interpolates an unvalidated role into Cedar", () => {
		expect(() => compiler.compile({ templateId: "tenant.role_capability", parameters: { allowedRoles: ['OWNER" || true || "'] } }, "org-123")).toThrow(PolicyTemplateError);
		expect(() => compiler.compile({ templateId: "tenant.role_capability", parameters: { allowedRoles: [] } }, "org-123")).toThrow(PolicyTemplateError);
	});
});

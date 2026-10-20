import { describe, expect, it } from "vitest";

import { CreatePolicyDraftSchema } from "../authorization-policy";

const TENANT_ID = "3f0a8c1e-2b4d-4e6f-8a9b-0c1d2e3f4a5b";
const BUILDER_PAYLOAD = { templateId: "tenant.role_capability", parameters: { allowedRoles: ["OWNER"] } };

describe("CreatePolicyDraftSchema", () => {
	it("accepts a TENANT draft that names its tenant", () => {
		const draft = { scope: "TENANT", tenantId: TENANT_ID, name: "Owners only", builderPayload: BUILDER_PAYLOAD };
		expect(CreatePolicyDraftSchema.parse(draft)).toEqual(draft);
	});

	it("rejects a TENANT draft without a tenant", () => {
		const result = CreatePolicyDraftSchema.safeParse({ scope: "TENANT", name: "Owners only", builderPayload: BUILDER_PAYLOAD });
		expect(result.success).toBe(false);
		expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual(["tenantId"]);
	});

	it("rejects a platform-scope draft that names a tenant", () => {
		for (const scope of ["PLATFORM_GUARDRAIL", "PLATFORM"]) {
			const result = CreatePolicyDraftSchema.safeParse({ scope, tenantId: TENANT_ID, name: "Guardrail", builderPayload: BUILDER_PAYLOAD });
			expect(result.success).toBe(false);
		}
	});

	it("accepts a platform-scope draft without a tenant", () => {
		const draft = { scope: "PLATFORM_GUARDRAIL", name: "Guardrail", builderPayload: BUILDER_PAYLOAD };
		expect(CreatePolicyDraftSchema.parse(draft)).toEqual(draft);
	});
});

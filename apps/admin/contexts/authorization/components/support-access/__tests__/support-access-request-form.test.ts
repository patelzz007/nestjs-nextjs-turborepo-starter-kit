import { epochMs, type SupportAccessGrantDetail } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { isRevocable } from "../support-access-console";
import { SupportAccessRequestFormSchema } from "../support-access-request-form";

const TENANT_ID = "0199a1b2-0000-7000-8000-000000000001";

describe("SupportAccessRequestFormSchema", () => {
	it("converts the raw form into the shared request contract", () => {
		expect(
			SupportAccessRequestFormSchema.parse({ tenantId: TENANT_ID, mode: "READ_ONLY", durationMinutes: "120", reason: "  Investigating ticket SUP-9  ", ticketRef: " SUP-9 " }),
		).toEqual({
			tenantId: TENANT_ID,
			mode: "READ_ONLY",
			durationMinutes: 120,
			reason: "Investigating ticket SUP-9",
			ticketRef: "SUP-9",
		});
	});

	it("rejects what the API rejects: no merchant, a reason under ten characters", () => {
		const result = SupportAccessRequestFormSchema.safeParse({ tenantId: "", mode: "READ_ONLY", durationMinutes: "60", reason: "short", ticketRef: "" });

		expect(result.success).toBe(false);
		expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual(expect.arrayContaining(["tenantId", "reason"]));
	});
});

describe("isRevocable", () => {
	function grant(status: SupportAccessGrantDetail["status"]): SupportAccessGrantDetail {
		return {
			id: "0199a1b2-0000-7000-8000-0000000000a1",
			tenantId: TENANT_ID,
			mode: "READ_ONLY",
			status,
			expiresAt: epochMs(1_792_368_000_000),
			createdAt: epochMs(1_792_368_000_000),
			tenant: { id: TENANT_ID, slug: "brew", displayName: "Brew" },
			supportUser: null,
			approvedBy: null,
			reason: "Investigating",
			ticketRef: null,
			revokedAt: null,
		};
	}

	it("offers revoking only a grant that has not ended", () => {
		expect(isRevocable(grant("PENDING_TENANT_APPROVAL"))).toBe(true);
		expect(isRevocable(grant("ACTIVE"))).toBe(true);
		expect(isRevocable(grant("EXPIRED"))).toBe(false);
		expect(isRevocable(grant("REVOKED"))).toBe(false);
	});
});

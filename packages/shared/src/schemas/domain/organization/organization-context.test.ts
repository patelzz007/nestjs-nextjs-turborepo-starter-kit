import { describe, expect, it } from "vitest";

import { OrganizationContextSummaryResponseSchema } from "./organization";

const SUMMARY = {
	id: "7f5f0f0e-7a53-4f5c-9d0a-0d6a6b8f2c11",
	slug: "acme-coffee",
	displayName: "Acme Coffee",
	lifecycleState: "ACTIVE",
	primaryLocationId: null,
	createdAt: 1_790_812_800_000,
	updatedAt: 1_790_812_800_000,
};

describe("OrganizationContextSummaryResponseSchema", () => {
	it("names the zone the merchant operates in (the zone its analytics are cut in)", () => {
		expect(OrganizationContextSummaryResponseSchema.safeParse(SUMMARY).success).toBe(false);
		expect(OrganizationContextSummaryResponseSchema.parse({ ...SUMMARY, timeZone: "Asia/Kuala_Lumpur" }).timeZone).toBe("Asia/Kuala_Lumpur");
	});

	it("rejects a zone that is not an IANA name", () => {
		expect(OrganizationContextSummaryResponseSchema.safeParse({ ...SUMMARY, timeZone: "Mars/Olympus" }).success).toBe(false);
	});
});

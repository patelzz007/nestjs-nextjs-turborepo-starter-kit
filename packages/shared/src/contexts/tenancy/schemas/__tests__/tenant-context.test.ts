import { describe, expect, it } from "vitest";

import { TenantContextSummaryResponseSchema } from "../tenant";

const SUMMARY = {
	id: "7f5f0f0e-7a53-4f5c-9d0a-0d6a6b8f2c11",
	slug: "acme-coffee",
	displayName: "Acme Coffee",
	lifecycleState: "ACTIVE",
	primaryLocationId: null,
	createdAt: 1_790_812_800_000,
	updatedAt: 1_790_812_800_000,
	logo: null,
};

describe("TenantContextSummaryResponseSchema", () => {
	it("names the zone the merchant operates in (the zone its analytics are cut in)", () => {
		expect(TenantContextSummaryResponseSchema.safeParse(SUMMARY).success).toBe(false);
		expect(TenantContextSummaryResponseSchema.parse({ ...SUMMARY, timeZone: "Asia/Kuala_Lumpur" }).timeZone).toBe("Asia/Kuala_Lumpur");
	});

	it("rejects a zone that is not an IANA name", () => {
		expect(TenantContextSummaryResponseSchema.safeParse({ ...SUMMARY, timeZone: "Mars/Olympus" }).success).toBe(false);
	});

	it("carries the store logo's file and public URL, or null when there is none", () => {
		const withZone = { ...SUMMARY, timeZone: "Asia/Kuala_Lumpur" };
		const logo = {
			fileId: "4e5f6a7b-8c9d-4e0f-9a1b-2c3d4e5f6a7b",
			url: "https://cdn.example.com/stores/logo.webp",
			sources: [{ width: 128, url: "https://cdn.example.com/stores/thumbnail/logo.webp" }],
		};

		expect(TenantContextSummaryResponseSchema.parse({ ...withZone, logo }).logo).toEqual(logo);
		expect(TenantContextSummaryResponseSchema.parse(withZone).logo).toBeNull();
		expect(TenantContextSummaryResponseSchema.safeParse({ ...withZone, logo: { ...logo, url: "javascript:alert(1)" } }).success).toBe(false);
	});
});

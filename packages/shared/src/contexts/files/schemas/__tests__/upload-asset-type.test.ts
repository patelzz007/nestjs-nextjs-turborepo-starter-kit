import { describe, expect, it } from "vitest";

import { CreateFileUploadUrlSchema, CreateTenantFileUploadUrlSchema } from "../storage";

const TENANT_ID = "0b6a3c55-2f1d-4e8a-a7b9-5c4d3e2f1a10";
const USER_ID = "1c7b4d66-3e2f-4f9b-b8ca-6d5e4f3a2b21";
const CHECKSUM = "a".repeat(64);

function ticket(category: "STORE_LOGO" | "STORE_BANNER" | "REWARD_IMAGE", assetType?: "LOGO" | "BANNER"): object {
	return {
		category,
		fileName: "logo.png",
		mimeType: "image/png",
		sizeBytes: 2048,
		checksumSha256: CHECKSUM,
		...(assetType === undefined ? {} : { assetType }),
	};
}

function issues(input: object): readonly string[] {
	const parsed = CreateTenantFileUploadUrlSchema.safeParse(input);
	return parsed.success ? [] : parsed.error.issues.map((issue) => issue.message);
}

describe("upload ticket routes (D23: the tenant comes from the route, never the body)", () => {
	it("refuses a tenantId in either upload body", () => {
		const avatar = { category: "USER_AVATAR", userId: USER_ID, fileName: "me.png", mimeType: "image/png", sizeBytes: 2048, checksumSha256: CHECKSUM };
		expect(CreateFileUploadUrlSchema.safeParse(avatar).success).toBe(true);
		expect(CreateFileUploadUrlSchema.safeParse({ ...avatar, tenantId: TENANT_ID }).success).toBe(false);
		expect(CreateTenantFileUploadUrlSchema.safeParse({ ...ticket("STORE_LOGO", "LOGO"), tenantId: TENANT_ID }).success).toBe(false);
	});

	it("takes each category on exactly one route", () => {
		expect(CreateFileUploadUrlSchema.safeParse(ticket("REWARD_IMAGE")).success).toBe(false);
		expect(
			CreateTenantFileUploadUrlSchema.safeParse({ category: "USER_AVATAR", fileName: "me.png", mimeType: "image/png", sizeBytes: 2048, checksumSha256: CHECKSUM }).success,
		).toBe(false);
	});
});

describe("upload ticket asset type", () => {
	it("accepts a logo labelled LOGO and a banner labelled BANNER", () => {
		expect(issues(ticket("STORE_LOGO", "LOGO"))).toEqual([]);
		expect(issues(ticket("STORE_BANNER", "BANNER"))).toEqual([]);
	});

	it("refuses a logo labelled as a banner, and a banner labelled as a logo", () => {
		expect(issues(ticket("STORE_LOGO", "BANNER"))).toEqual(["assetType must be LOGO for STORE_LOGO uploads"]);
		expect(issues(ticket("STORE_BANNER", "LOGO"))).toEqual(["assetType must be BANNER for STORE_BANNER uploads"]);
	});

	it("still requires the label for store assets, and refuses it on any other category", () => {
		expect(issues(ticket("STORE_LOGO"))).toEqual(["assetType is required for store asset uploads"]);
		expect(issues(ticket("REWARD_IMAGE", "LOGO"))).toEqual(["assetType is only for store logo and banner uploads"]);
	});
});

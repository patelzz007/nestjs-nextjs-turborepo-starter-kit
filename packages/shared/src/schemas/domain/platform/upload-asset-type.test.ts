import { describe, expect, it } from "vitest";

import { CreateFileUploadUrlSchema } from "./storage";

const ORGANIZATION_ID = "0b6a3c55-2f1d-4e8a-a7b9-5c4d3e2f1a10";
const CHECKSUM = "a".repeat(64);

function ticket(category: "STORE_LOGO" | "STORE_BANNER" | "REWARD_IMAGE", assetType?: "LOGO" | "BANNER"): object {
	return {
		category,
		organizationId: ORGANIZATION_ID,
		fileName: "logo.png",
		mimeType: "image/png",
		sizeBytes: 2048,
		checksumSha256: CHECKSUM,
		...(assetType === undefined ? {} : { assetType }),
	};
}

function issues(input: object): readonly string[] {
	const parsed = CreateFileUploadUrlSchema.safeParse(input);
	return parsed.success ? [] : parsed.error.issues.map((issue) => issue.message);
}

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

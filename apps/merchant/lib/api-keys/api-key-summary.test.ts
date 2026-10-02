import { MerchantApiKeySummarySchema, type MerchantApiKeySummary } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { filterApiKeys, summarizeApiKeys } from "@/lib/api-keys/api-key-summary";

const NOW = 1_790_812_800_000;
const STORE_A = "0f0f0f0f-0000-4000-8000-00000000000a";
const STORE_B = "0f0f0f0f-0000-4000-8000-00000000000b";

let sequence = 0;

function key(name: string, locationId: string | null, revokedAt: number | null): MerchantApiKeySummary {
	sequence += 1;
	return MerchantApiKeySummarySchema.parse({
		id: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
		name,
		locationId,
		locationName: locationId === null ? null : "Store",
		revokedAt,
		createdAt: NOW,
		updatedAt: NOW,
		isDeleted: false,
		deletedAt: null,
	});
}

describe("summarizeApiKeys", () => {
	it("counts active and revoked keys and the distinct stores with an active key", () => {
		const stats = summarizeApiKeys([key("A1", STORE_A, null), key("A2", STORE_A, null), key("B", STORE_B, null), key("Old", STORE_B, NOW)]);

		expect(stats).toEqual({ active: 3, revoked: 1, storesCovered: 2, hasOrganizationWideKey: false });
	});

	it("notes an active organization-wide key, and ignores revoked keys' stores", () => {
		const stats = summarizeApiKeys([key("Everywhere", null, null), key("Gone", STORE_A, NOW)]);

		expect(stats).toEqual({ active: 1, revoked: 1, storesCovered: 0, hasOrganizationWideKey: true });
	});

	it("is all zero for no keys", () => {
		expect(summarizeApiKeys([])).toEqual({ active: 0, revoked: 0, storesCovered: 0, hasOrganizationWideKey: false });
	});
});

describe("filterApiKeys", () => {
	const keys = [key("Revoked", STORE_A, NOW), key("Live", STORE_A, null)];

	it("shows only active or only revoked keys", () => {
		expect(filterApiKeys(keys, "active").map((item) => item.name)).toEqual(["Live"]);
		expect(filterApiKeys(keys, "revoked").map((item) => item.name)).toEqual(["Revoked"]);
	});

	it("lists every key with active ones first", () => {
		expect(filterApiKeys(keys, "all").map((item) => item.name)).toEqual(["Live", "Revoked"]);
	});
});

import { MerchantApiKeySummarySchema, type MerchantApiKeySummary } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { API_KEY_COUNT_PAGE_SIZE, summarizeApiKeys, toApiKeyListQuery } from "@/lib/api-keys/api-key-summary";
import { MERCHANT_API_KEYS_PAGE_SIZE } from "@workspace/shared";

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
		scope: "POS",
		revokedAt,
		createdAt: NOW,
		updatedAt: NOW,
		isDeleted: false,
		deletedAt: null,
	});
}

describe("summarizeApiKeys", () => {
	it("takes the active and revoked totals from the API, and counts stores across a complete set of active keys", () => {
		const active = [key("A1", STORE_A, null), key("A2", STORE_A, null), key("B", STORE_B, null)];

		expect(summarizeApiKeys({ keys: active, total: 3 }, 7)).toEqual({ active: 3, revoked: 7, coverage: { kind: "exact", stores: 2, hasOrganizationWideKey: false } });
	});

	it("notes an active organization-wide key", () => {
		expect(summarizeApiKeys({ keys: [key("Everywhere", null, null)], total: 1 }, 0).coverage).toEqual({ kind: "exact", stores: 0, hasOrganizationWideKey: true });
	});

	it("reports store coverage as unavailable instead of undercounting when more active keys exist than one page holds", () => {
		const stats = summarizeApiKeys({ keys: [key("A1", STORE_A, null)], total: 250 }, 4);

		expect(stats).toEqual({ active: 250, revoked: 4, coverage: { kind: "unavailable" } });
	});

	it("is all zero for no keys", () => {
		expect(summarizeApiKeys({ keys: [], total: 0 }, 0)).toEqual({ active: 0, revoked: 0, coverage: { kind: "exact", stores: 0, hasOrganizationWideKey: false } });
	});
});

describe("toApiKeyListQuery", () => {
	it("asks the API for exactly the keys a status view shows", () => {
		expect(toApiKeyListQuery("acme", STORE_A, "active")).toEqual({
			orgSlug: "acme",
			page: 1,
			limit: MERCHANT_API_KEYS_PAGE_SIZE,
			locationId: STORE_A,
			filter: { revokedAt: { isNull: true } },
		});
		expect(toApiKeyListQuery("acme", undefined, "revoked", API_KEY_COUNT_PAGE_SIZE)).toEqual({
			orgSlug: "acme",
			page: 1,
			limit: API_KEY_COUNT_PAGE_SIZE,
			locationId: undefined,
			filter: { revokedAt: { isNull: false } },
		});
		expect(toApiKeyListQuery("acme", undefined, "all")).toEqual({ orgSlug: "acme", page: 1, limit: MERCHANT_API_KEYS_PAGE_SIZE, locationId: undefined });
	});
});

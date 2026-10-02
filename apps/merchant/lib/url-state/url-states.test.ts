// Page-level parsing: the server page parses its `searchParams` with these
// codecs (redemptions prefetch) and the views read the same declarations from
// `useSearchParams()`. These tests pin the URL ⇄ state ⇄ API-input mapping.

import { MerchantRedemptionListQuerySchema, OrganizationSlugParamSchema } from "@workspace/shared";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { MERCHANT_REDEMPTIONS_PAGE_SIZE } from "@/lib/redemptions/redemptions-page";
import { TEST_ORG_SLUG } from "@/test/authorization";
import { STORE_A } from "@/test/terminals";

import { API_KEYS_URL_STATE } from "./api-keys";
import { REDEMPTIONS_URL_STATE, toRedemptionsQuery } from "./redemptions";

/** The contract input of `GET /orgs/:orgSlug/redemptions`. */
const RedemptionsRequestSchema = z.intersection(OrganizationSlugParamSchema, MerchantRedemptionListQuerySchema);

describe("API_KEYS_URL_STATE", () => {
	it("opens on active keys and keeps that default out of the URL", () => {
		expect(API_KEYS_URL_STATE.parse({})).toEqual({ status: "active" });
		expect(API_KEYS_URL_STATE.serialize({ status: "active" })).toBe("");
	});

	it("reads and writes the revoked and all views", () => {
		expect(API_KEYS_URL_STATE.parse({ status: "revoked" })).toEqual({ status: "revoked" });
		expect(API_KEYS_URL_STATE.serialize({ status: "all" })).toBe("status=all");
	});

	it("falls back to active keys for an unknown value", () => {
		expect(API_KEYS_URL_STATE.parse({ status: "deleted" })).toEqual({ status: "active" });
	});
});

describe("REDEMPTIONS_URL_STATE", () => {
	it("maps a page URL and the store scope to the input the contract accepts", () => {
		const input = toRedemptionsQuery(TEST_ORG_SLUG, STORE_A.id, REDEMPTIONS_URL_STATE.parse({ page: "2", cursor: "abc" }));

		expect(input).toEqual({ orgSlug: TEST_ORG_SLUG, page: 2, limit: MERCHANT_REDEMPTIONS_PAGE_SIZE, cursor: "abc", locationId: STORE_A.id });
		expect(RedemptionsRequestSchema.safeParse(input).success).toBe(true);
	});

	it("requests the newest page for every store from an empty or hostile URL", () => {
		const input = toRedemptionsQuery(TEST_ORG_SLUG, undefined, REDEMPTIONS_URL_STATE.parse({ page: "-1", limit: "500", sort: "terminalId" }));

		expect(input).toEqual({ orgSlug: TEST_ORG_SLUG, page: 1, limit: MERCHANT_REDEMPTIONS_PAGE_SIZE, locationId: undefined });
		expect(RedemptionsRequestSchema.safeParse(input).success).toBe(true);
	});

	it("drops the keyset cursor under a custom sort (oldest first)", () => {
		const input = toRedemptionsQuery(TEST_ORG_SLUG, undefined, REDEMPTIONS_URL_STATE.parse({ page: "2", cursor: "abc", sort: "redeemedAt" }));

		expect(input).toEqual({ orgSlug: TEST_ORG_SLUG, page: 2, limit: MERCHANT_REDEMPTIONS_PAGE_SIZE, sort: "redeemedAt", locationId: undefined });
	});
});

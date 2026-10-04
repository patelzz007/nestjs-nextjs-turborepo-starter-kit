// The wallet server page and the wallet view build their `GET /claims` inputs
// from the same URL with these functions, so the prefetched page and the client
// query share a key. These tests pin the URL ⇄ request mapping.

import { RewardClaimListQuerySchema } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { toReadyToRedeemCountQuery, toWalletClaimsListQuery, WALLET_CLAIMS_PAGE_SIZE, WALLET_CLAIMS_URL_STATE } from "./wallet-claims";

describe("WALLET_CLAIMS_URL_STATE", () => {
	it("maps the wallet URL to the list input the API accepts", () => {
		const input = toWalletClaimsListQuery(WALLET_CLAIMS_URL_STATE.parse({ page: "3", cursor: "abc" }));

		expect(input).toEqual({ page: 3, limit: WALLET_CLAIMS_PAGE_SIZE, cursor: "abc" });
		expect(RewardClaimListQuerySchema.safeParse(input).success).toBe(true);
	});

	it("falls back to the first page at the fixed page size for an empty or hostile URL", () => {
		expect(toWalletClaimsListQuery(WALLET_CLAIMS_URL_STATE.parse({}))).toEqual({ page: 1, limit: WALLET_CLAIMS_PAGE_SIZE });
		expect(toWalletClaimsListQuery(WALLET_CLAIMS_URL_STATE.parse({ page: "-1", limit: "500", sort: "secret" }))).toEqual({ page: 1, limit: WALLET_CLAIMS_PAGE_SIZE });
	});

	it("keeps the default state out of the URL", () => {
		expect(WALLET_CLAIMS_URL_STATE.serialize(WALLET_CLAIMS_URL_STATE.defaults)).toBe("");
		expect(WALLET_CLAIMS_URL_STATE.serialize({ ...WALLET_CLAIMS_URL_STATE.defaults, page: 2 })).toBe("page=2");
	});
});

describe("toReadyToRedeemCountQuery", () => {
	it("asks the server to count every PENDING claim on the account (one row; the count is meta.total)", () => {
		const input = toReadyToRedeemCountQuery();

		expect(input).toEqual({ page: 1, limit: 1, filter: { status: { eq: "PENDING" } } });
		expect(RewardClaimListQuerySchema.safeParse(input).success).toBe(true);
	});
});

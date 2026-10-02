// The server page parses its `searchParams` with this codec and prefetches the
// resulting input; the catalog builds the same input from `useSearchParams()`.
// These tests pin the URL ⇄ `GET /rewards` mapping.

import { RewardListQuerySchema } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { REWARDS_BROWSE_PAGE_SIZE, REWARDS_BROWSE_URL_STATE, toRewardsBrowseListQuery } from "./rewards-browse";

describe("REWARDS_BROWSE_URL_STATE", () => {
	it("maps a full catalog URL to the input the list schema accepts", () => {
		const state = REWARDS_BROWSE_URL_STATE.parse({ page: "2", cursor: "abc", search: "latte", "filter[city]": "MELAKA", "filter[category]": "cafe" });
		const input = toRewardsBrowseListQuery(state);

		expect(input).toEqual({
			page: 2,
			limit: REWARDS_BROWSE_PAGE_SIZE,
			cursor: "abc",
			search: "latte",
			filter: { city: { eq: "MELAKA" }, category: { eq: "cafe" } },
		});
		expect(RewardListQuerySchema.safeParse(input).success).toBe(true);
	});

	it("sends one filter without the other", () => {
		expect(toRewardsBrowseListQuery(REWARDS_BROWSE_URL_STATE.parse({ "filter[category]": "retail" })).filter).toEqual({ city: undefined, category: { eq: "retail" } });
	});

	it("falls back to the first page of the whole catalog for an empty or hostile URL", () => {
		expect(toRewardsBrowseListQuery(REWARDS_BROWSE_URL_STATE.parse({}))).toEqual({ page: 1, limit: REWARDS_BROWSE_PAGE_SIZE });
		expect(
			toRewardsBrowseListQuery(
				REWARDS_BROWSE_URL_STATE.parse({ page: "0", limit: "500", sort: "merchantSecret", search: "   ", "filter[city]": "ATLANTIS", "filter[category]": "weapons" }),
			),
		).toEqual({ page: 1, limit: REWARDS_BROWSE_PAGE_SIZE });
	});

	it("keeps the default state out of the URL and writes filters under the list grammar's keys", () => {
		expect(REWARDS_BROWSE_URL_STATE.serialize(REWARDS_BROWSE_URL_STATE.defaults)).toBe("");
		expect(REWARDS_BROWSE_URL_STATE.serialize({ ...REWARDS_BROWSE_URL_STATE.defaults, city: "KUALA_LUMPUR", search: "spa" })).toBe("search=spa&filter[city]=KUALA_LUMPUR");
	});
});

import { ApiError } from "@workspace/client/lib/api/api-request";
import { describe, expect, it } from "vitest";

import { readReferralToken, referralAttributionMessage, referralLinkPath, referralShareErrorMessage, withReferralToken } from "../referral-link";

const REWARD_ID = "00000000-0000-4000-8000-000000000001";
const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcde";

function apiError(code: string): ApiError {
	return new ApiError({ message: "API said no", error: code, statusCode: 409 });
}

describe("referral links", () => {
	it("opens the public reward page with the token", () => {
		expect(referralLinkPath(REWARD_ID, TOKEN)).toBe(`/rewards/${REWARD_ID}?ref=${TOKEN}`);
	});

	it("reads only a token the API could have issued", () => {
		expect(readReferralToken(new URLSearchParams({ ref: TOKEN }))).toBe(TOKEN);
		expect(readReferralToken(new URLSearchParams({ ref: "short" }))).toBeNull();
		expect(readReferralToken(new URLSearchParams())).toBeNull();
	});

	it("keeps the token on the sign-in return path, and leaves a plain path alone", () => {
		expect(withReferralToken(`/rewards/${REWARD_ID}`, TOKEN)).toBe(`/rewards/${REWARD_ID}?ref=${TOKEN}`);
		expect(withReferralToken(`/rewards/${REWARD_ID}`, null)).toBe(`/rewards/${REWARD_ID}`);
	});

	it("tells the visitor what happened to the link, in the API's terms", () => {
		expect(referralAttributionMessage(null)).toContain("within 7 days");
		expect(referralAttributionMessage(apiError("REFERRAL_OWN_LINK"))).toBe("This is your own referral link. Share it with a friend instead.");
		expect(referralAttributionMessage(apiError("REFERRAL_LINK_INVALID"))).toBe("This referral link is no longer valid. You can still claim the reward.");
		expect(referralAttributionMessage(new Error("Network down"))).toBe("Network down");
	});

	it("explains a reward that cannot be shared", () => {
		expect(referralShareErrorMessage(apiError("REFERRAL_REWARD_NOT_REFERABLE"))).toBe("This reward cannot be shared right now.");
		expect(referralShareErrorMessage(apiError("REFERRAL_LINK_LIMIT_REACHED"))).toBe("API said no");
	});
});

import { describe, expect, it } from "vitest";
import { epochMs } from "@workspace/shared";

import { isSignupReferralCodeDue, signupReferralDashboardOf } from "../policies/signup-referral-dashboard.policy";

const NOW = 1_800_000_000_000;
const ACTIVE = { isDeleted: false, isActive: true };

describe("signupReferralDashboardOf", () => {
	it("is pending for an account the job has not given a code yet", () => {
		expect(signupReferralDashboardOf({ latestCode: null, account: ACTIVE }, NOW)).toEqual({ code: null, expiresAt: null, shareable: false, codeState: "pending" });
	});

	it("is shareable only while active and inside the window", () => {
		expect(signupReferralDashboardOf({ latestCode: { code: "AB23CD45", expiresAt: epochMs(NOW + 1) }, account: ACTIVE }, NOW)).toEqual({
			code: "AB23CD45",
			expiresAt: NOW + 1,
			shareable: true,
			codeState: "active",
		});
	});

	it("labels expiry at now >= expiresAt, before deactivation", () => {
		expect(signupReferralDashboardOf({ latestCode: { code: "AB23CD45", expiresAt: epochMs(NOW) }, account: { isDeleted: false, isActive: false } }, NOW)).toMatchObject({
			shareable: false,
			codeState: "expired",
		});
	});

	it("labels a deactivated, deleted or vanished owner's in-window code unavailable", () => {
		const latestCode = { code: "AB23CD45", expiresAt: epochMs(NOW + 1) };

		expect(signupReferralDashboardOf({ latestCode, account: { isDeleted: false, isActive: false } }, NOW)).toMatchObject({ shareable: false, codeState: "unavailable" });
		expect(signupReferralDashboardOf({ latestCode, account: { isDeleted: true, isActive: true } }, NOW)).toMatchObject({ shareable: false, codeState: "unavailable" });
		expect(signupReferralDashboardOf({ latestCode, account: null }, NOW)).toMatchObject({ shareable: false, codeState: "unavailable" });
	});
});

describe("isSignupReferralCodeDue", () => {
	it("issues a first code to a live user with none, and a successor once the latest code expired", () => {
		expect(isSignupReferralCodeDue({ isDeleted: false, latestExpiresAt: null }, NOW)).toBe(true);
		expect(isSignupReferralCodeDue({ isDeleted: false, latestExpiresAt: NOW }, NOW)).toBe(true);
	});

	it("issues nothing when another run already issued a valid code, the user was deleted, or the row is gone", () => {
		expect(isSignupReferralCodeDue({ isDeleted: false, latestExpiresAt: NOW + 1 }, NOW)).toBe(false);
		expect(isSignupReferralCodeDue({ isDeleted: true, latestExpiresAt: null }, NOW)).toBe(false);
		expect(isSignupReferralCodeDue(null, NOW)).toBe(false);
	});
});

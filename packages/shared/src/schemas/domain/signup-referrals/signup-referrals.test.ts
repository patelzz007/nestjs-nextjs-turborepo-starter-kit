import { describe, expect, it } from "vitest";

import { ConsumerWebSignupSchema, SignupSchema } from "../../auth/auth";
import { AdminUserListQuerySchema } from "../../auth/user";
import { SIGNUP_REFERRAL_CODE_LENGTH } from "./signup-referral.constants";
import { SignupReferralCodeInputSchema, SignupReferralErrorCodeSchema } from "./signup-referrals";

const VALID_SIGNUP = { email: "jane@example.com", password: "StrongP@ss1", fullName: "Jane Doe" };

describe("SignupReferralCodeInputSchema", () => {
	it("trims the code and keeps its case for the server to fold", () => {
		expect(SignupReferralCodeInputSchema.parse("  ab23cd45 ")).toBe("ab23cd45");
	});

	it("accepts an omitted value and a JSON null as no code", () => {
		expect(SignupReferralCodeInputSchema.parse(undefined)).toBeUndefined();
		expect(SignupReferralCodeInputSchema.parse(null)).toBeNull();
	});

	it("rejects a value longer than an issued code after trimming", () => {
		expect(SignupReferralCodeInputSchema.safeParse(`${"A".repeat(SIGNUP_REFERRAL_CODE_LENGTH)}B`).success).toBe(false);
		expect(SignupReferralCodeInputSchema.safeParse(` ${"A".repeat(SIGNUP_REFERRAL_CODE_LENGTH)} `).success).toBe(true);
	});
});

describe("signup schemas", () => {
	it("keeps the base signup schema strict, without a referral code (mobile signup)", () => {
		expect(SignupSchema.safeParse({ ...VALID_SIGNUP, referralCode: "AB23CD45" }).success).toBe(false);
	});

	it("accepts the optional referral code on consumer web signup", () => {
		expect(ConsumerWebSignupSchema.parse({ ...VALID_SIGNUP, referralCode: "AB23CD45" }).referralCode).toBe("AB23CD45");
		expect(ConsumerWebSignupSchema.parse(VALID_SIGNUP).referralCode).toBeUndefined();
		expect(ConsumerWebSignupSchema.parse({ ...VALID_SIGNUP, referralCode: null }).referralCode).toBeNull();
	});

	it("stays strict for unknown keys on consumer web signup", () => {
		expect(ConsumerWebSignupSchema.safeParse({ ...VALID_SIGNUP, referrerId: "someone" }).success).toBe(false);
	});
});

describe("SignupReferralErrorCodeSchema", () => {
	it("lists exactly the three ADR 035 error codes", () => {
		expect(SignupReferralErrorCodeSchema.options).toEqual(["REFERRAL_CODE_UNRECOGNIZED", "REFERRAL_CODE_EXPIRED", "REFERRAL_CODE_UNAVAILABLE"]);
	});
});

describe("admin user list referral filters", () => {
	const REFERRER_ID = "8c1b6d2e-4f3a-4b5c-9d6e-7f8a9b0c1d2e";

	it("accepts a referrer id and a referral status together", () => {
		const query = AdminUserListQuerySchema.parse({ filter: { referrerId: { eq: REFERRER_ID }, referralStatus: { eq: "redeemed" } } });

		expect(query.filter?.referrerId?.eq).toBe(REFERRER_ID);
		expect(query.filter?.referralStatus?.eq).toBe("redeemed");
	});

	it("rejects a referrer id that is not a user id and a status outside the referral states", () => {
		expect(AdminUserListQuerySchema.safeParse({ filter: { referrerId: { eq: "not-a-user-id" } } }).success).toBe(false);
		expect(AdminUserListQuerySchema.safeParse({ filter: { referralStatus: { eq: "active" } } }).success).toBe(false);
	});
});

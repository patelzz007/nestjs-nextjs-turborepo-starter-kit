import { describe, expect, it } from "vitest";

import { evaluateSignupReferralCode, type SignupReferralCodeForValidation } from "./signup-referral-code.validity";

const NOW = 1_800_000_000_000;
const ONE_MS = 1;

function codeRow(
	overrides: Partial<Omit<SignupReferralCodeForValidation, "owner">> = {},
	owner: Partial<SignupReferralCodeForValidation["owner"]> = {},
): SignupReferralCodeForValidation {
	return {
		id: "code-a",
		userId: "user-a",
		expiresAt: BigInt(NOW + ONE_MS),
		isDeleted: false,
		...overrides,
		owner: { isDeleted: false, isActive: true, latestCodeId: "code-a", ...owner },
	};
}

describe("evaluateSignupReferralCode", () => {
	it("accepts the owner's latest, unexpired code of an active, non-deleted owner", () => {
		expect(evaluateSignupReferralCode(codeRow(), NOW)).toEqual({ kind: "valid", referrerUserId: "user-a", referralCodeId: "code-a" });
	});

	it("rejects an unknown or soft-deleted code row as unrecognized", () => {
		expect(evaluateSignupReferralCode(null, NOW)).toEqual({ kind: "rejected", rejection: "unrecognized" });
		expect(evaluateSignupReferralCode(codeRow({ isDeleted: true }), NOW)).toEqual({ kind: "rejected", rejection: "unrecognized" });
	});

	it("rejects an older row of the owner as expired even inside its window", () => {
		expect(evaluateSignupReferralCode(codeRow({}, { latestCodeId: "code-b" }), NOW)).toEqual({ kind: "rejected", rejection: "expired" });
	});

	it("treats expiresAt as exclusive", () => {
		expect(evaluateSignupReferralCode(codeRow({ expiresAt: BigInt(NOW) }), NOW)).toEqual({ kind: "rejected", rejection: "expired" });
		expect(evaluateSignupReferralCode(codeRow({ expiresAt: BigInt(NOW + ONE_MS) }), NOW).kind).toBe("valid");
	});

	it("rejects the latest code of a deactivated or soft-deleted owner as unavailable", () => {
		expect(evaluateSignupReferralCode(codeRow({}, { isActive: false }), NOW)).toEqual({ kind: "rejected", rejection: "unavailable" });
		expect(evaluateSignupReferralCode(codeRow({}, { isDeleted: true }), NOW)).toEqual({ kind: "rejected", rejection: "unavailable" });
	});

	it("reports expired before unavailable, matching the ADR table", () => {
		expect(evaluateSignupReferralCode(codeRow({ expiresAt: BigInt(NOW) }, { isActive: false }), NOW)).toEqual({ kind: "rejected", rejection: "expired" });
	});
});

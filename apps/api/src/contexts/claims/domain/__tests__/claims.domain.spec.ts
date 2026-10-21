import { describe, expect, it } from "vitest";
import { epochMs, type EpochMs } from "@workspace/shared";

import { OtpChallenge } from "../aggregates/otp-challenge.aggregate";
import { RewardClaim, type RewardClaimState } from "../aggregates/reward-claim.aggregate";
import { ClaimExpiredError, ClaimLimitReachedError, ClaimNotActiveError, OtpAttemptsExhaustedError, OtpMissingError } from "../errors/claims.errors";
import { ClaimCodesIssued, ClaimExpired, ClaimRedeemed, RewardClaimed } from "../events/claim.events";
import { assertWithinClaimLimit } from "../policies/claim-limit.policy";
import { claimNeedsOtp, liveAttributionToken } from "../policies/phone-verification.policy";
import { CLAIM_TTL_MS, MAX_OTP_ATTEMPTS, OTP_TTL_MS } from "../value-objects/claim-rules.value-object";
import { CorruptAggregateStateError } from "../../../../platform/domain/errors/corrupt-aggregate-state.error";

const NOW: EpochMs = epochMs(1_800_000_000_000);
const CODES = { redemptionTokenHash: "token-hash", backupCodeHash: "backup-hash" };
const NEW_CODES = { redemptionTokenHash: "token-hash-2", backupCodeHash: "backup-hash-2" };

function stored(overrides: Partial<RewardClaimState> = {}): RewardClaim {
	return RewardClaim.rehydrate({
		id: "claim-1",
		userId: "user-1",
		rewardId: "reward-1",
		referralId: null,
		status: "PENDING",
		isReferrerCredit: false,
		claimedAt: NOW,
		claimExpiresAt: epochMs(NOW + CLAIM_TTL_MS),
		redeemedAt: null,
		codes: CODES,
		...overrides,
	});
}

describe("RewardClaim.create", () => {
	it("is pending for the claim window, never past the reward's own expiry", () => {
		const longLived = RewardClaim.create({ id: "c", userId: "u", rewardId: "r", referralId: null, codes: CODES, rewardExpiry: epochMs(NOW + 100 * CLAIM_TTL_MS) }, NOW);
		const shortLived = RewardClaim.create({ id: "c", userId: "u", rewardId: "r", referralId: null, codes: CODES, rewardExpiry: epochMs(NOW + 1000) }, NOW);

		expect(longLived.snapshot()).toMatchObject({ status: "PENDING", claimExpiresAt: NOW + CLAIM_TTL_MS, redeemedAt: null });
		expect(shortLived.claimExpiresAt).toBe(NOW + 1000);
		expect(longLived.concurrencyToken).toBeNull();
		expect(longLived.pullEvents()).toEqual([expect.any(RewardClaimed)]);
	});
});

describe("RewardClaim lifecycle", () => {
	it("issues new codes only while live, demanding the claim still be live at save", () => {
		const claim = stored();

		claim.issueCodes(NEW_CODES, NOW);

		expect(claim.snapshot().codes).toEqual(NEW_CODES);
		expect(claim.mustBeLiveAt).toBe(NOW);
		expect(claim.pullEvents()).toEqual([expect.any(ClaimCodesIssued)]);
		expect(() => {
			stored({ status: "EXPIRED" }).issueCodes(NEW_CODES, NOW);
		}).toThrow(ClaimNotActiveError);
		expect(() => {
			stored({ claimExpiresAt: epochMs(NOW - 1) }).issueCodes(NEW_CODES, NOW);
		}).toThrow(ClaimExpiredError);
	});

	it("redeems a live claim once, stamping the redemption time", () => {
		const claim = stored();

		expect(claim.isRedeemableAt(NOW)).toBe(true);
		claim.redeem(NOW);

		expect(claim.snapshot()).toMatchObject({ status: "REDEEMED", redeemedAt: NOW });
		expect(claim.pullEvents()).toEqual([expect.any(ClaimRedeemed)]);
		expect(() => {
			claim.redeem(NOW);
		}).toThrow(ClaimNotActiveError);
		expect(stored({ claimExpiresAt: epochMs(NOW - 1) }).isRedeemableAt(NOW)).toBe(false);
	});

	it("expires only a pending claim past its window", () => {
		const overdue = stored({ claimExpiresAt: epochMs(NOW - 1) });

		expect(stored().isOverdue(NOW)).toBe(false);
		expect(() => {
			stored().expire("org-1", NOW);
		}).toThrow(ClaimNotActiveError);
		overdue.expire("org-1", NOW);
		expect(overdue.currentStatus).toBe("EXPIRED");
		expect(overdue.pullEvents()).toEqual([expect.objectContaining({ tenantId: "org-1" })]);
		expect(new ClaimExpired(NOW, { claimId: "c", userId: "u", rewardId: "r", isReferrerCredit: false }, "org-1").tenantId).toBe("org-1");
	});

	it("refuses a stored row whose status and redemption stamp disagree, or an unknown status", () => {
		expect(() => stored({ status: "REDEEMED", redeemedAt: null })).toThrow(CorruptAggregateStateError);
		expect(() => stored({ status: "PENDING", redeemedAt: NOW })).toThrow(CorruptAggregateStateError);
		expect(() => stored({ status: "LOST" })).toThrow(CorruptAggregateStateError);
	});
});

describe("OtpChallenge", () => {
	function issued(): OtpChallenge {
		return OtpChallenge.issue("otp-1", "user-1", "+60123", "reward-1", "code-hash", NOW);
	}

	it("expires after the OTP window and is consumed by the right code", () => {
		const challenge = issued();

		expect(challenge.snapshot().expiresAt).toBe(NOW + OTP_TTL_MS);
		expect(challenge.verify("code-hash", NOW)).toBe(true);
		expect(challenge.isConsumed).toBe(true);
		expect(() => challenge.verify("code-hash", NOW)).toThrow(OtpMissingError);
	});

	it("counts every wrong attempt and stops at the limit", () => {
		const challenge = issued();

		for (let attempt = 0; attempt < MAX_OTP_ATTEMPTS; attempt += 1) {
			expect(challenge.verify("wrong", NOW)).toBe(false);
		}

		expect(challenge.snapshot()).toMatchObject({ attempts: MAX_OTP_ATTEMPTS, failedAttempts: MAX_OTP_ATTEMPTS, consumedAt: null });
		expect(() => challenge.verify("code-hash", NOW)).toThrow(OtpAttemptsExhaustedError);
	});

	it("refuses an expired challenge and corrupt counters", () => {
		expect(() => issued().verify("code-hash", epochMs(NOW + OTP_TTL_MS + 1))).toThrow(OtpMissingError);
		expect(() => OtpChallenge.rehydrate({ ...issued().snapshot(), attempts: 1, failedAttempts: 2 })).toThrow(CorruptAggregateStateError);
		expect(() => OtpChallenge.rehydrate({ ...issued().snapshot(), attempts: -1 })).toThrow(CorruptAggregateStateError);
	});
});

describe("Claim policies", () => {
	it("caps the claims a customer may hold of one reward", () => {
		expect(() => {
			assertWithinClaimLimit(0, 1);
		}).not.toThrow();
		expect(() => {
			assertWithinClaimLimit(1, 1);
		}).toThrow(ClaimLimitReachedError);
		expect(() => {
			assertWithinClaimLimit(99, null);
		}).not.toThrow();
	});

	it("needs an OTP unless the claim uses the customer's verified phone", () => {
		expect(claimNeedsOtp({ phone: "+60123", phoneVerifiedAt: NOW }, "+60123")).toBe(false);
		expect(claimNeedsOtp({ phone: "+60123", phoneVerifiedAt: NOW }, "+60999")).toBe(true);
		expect(claimNeedsOtp({ phone: "+60123", phoneVerifiedAt: null }, "+60123")).toBe(true);
	});

	it("spends a referral attribution only while it is live", () => {
		expect(liveAttributionToken("token", null, NOW)).toBe("token");
		expect(liveAttributionToken("token", NOW, NOW)).toBe("token");
		expect(liveAttributionToken("token", epochMs(NOW - 1), NOW)).toBeNull();
		expect(liveAttributionToken(null, null, NOW)).toBeNull();
	});
});

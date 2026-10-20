import type { EpochMs } from "@workspace/shared";

/** The claimant's verified phone, as the claim checks it. */
export interface VerifiedPhone {
	readonly phone: string | null;
	readonly phoneVerifiedAt: EpochMs | null;
}

/** A claim made with the phone the customer already verified needs no OTP; any other phone does. */
export function claimNeedsOtp(claimant: VerifiedPhone, phone: string): boolean {
	return claimant.phoneVerifiedAt === null || claimant.phone !== phone;
}

/** A pending referral attribution is live until its expiry (no expiry = live). */
export function liveAttributionToken(token: string | null, expiresAt: EpochMs | null, now: EpochMs): string | null {
	if (token === null || (expiresAt !== null && expiresAt < now)) {
		return null;
	}
	return token;
}

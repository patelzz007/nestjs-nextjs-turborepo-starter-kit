import { epochMs, type EpochMs } from "@workspace/shared";

import { PosCodeLockedError } from "../errors/pos.errors";

const MINUTE_MS = 60_000;

/** Unknown backup codes are counted per API key over this window. */
export const POS_CODE_FAILURE_WINDOW_MS = 15 * MINUTE_MS;

/**
 * Unknown backup codes one key may present per window before it is locked. A cashier mistyping a
 * code a few times stays well below; a script guessing 8-character codes is stopped after this many.
 */
export const POS_CODE_MAX_FAILURES = 10;

/** How long a key that hit {@link POS_CODE_MAX_FAILURES} stays locked for code redemption. */
export const POS_CODE_LOCKOUT_MS = 60 * MINUTE_MS;

/**
 * Brute-force protection for backup codes. A wrong code matches no claim, so failures are counted on
 * the API key that presented them (one key = one till for paired keys). Every unknown code in a
 * request counts (a 10-code checkout is 10 guesses), and successful lookups never reset the count:
 * interleaving one valid code must not buy more guesses.
 */
export function assertCodeRedemptionUnlocked(lockedUntil: EpochMs | null, now: EpochMs): void {
	if (lockedUntil !== null && lockedUntil > now) {
		throw new PosCodeLockedError(lockedUntil);
	}
}

/** Until when the key is locked after its window reached `failuresInWindow`, or null while it is still under the limit. */
export function lockoutAfter(failuresInWindow: number, now: EpochMs): EpochMs | null {
	return failuresInWindow < POS_CODE_MAX_FAILURES ? null : epochMs(now + POS_CODE_LOCKOUT_MS);
}

import type { Prisma } from "@prisma/client";
import { MINOR_UNITS_PER_MAJOR, RewardRulesSchema, type RedemptionCheckoutInput, type RedemptionInvalidReason } from "@workspace/shared";

import type { RewardClaimRedemptionLookup } from "../repositories/reward-claim.repository";
import { sha256Hex } from "./reward-crypto.util";

/** `rules.minSpendMyr` (ringgit, possibly fractional) → minor units; `null` when the reward has no valid minimum. */
export function minSpendMinorFromRules(rules: Prisma.JsonValue | null): number | null {
	if (rules === null) {
		return null;
	}
	const parsed = RewardRulesSchema.safeParse(rules);
	if (!parsed.success || parsed.data.minSpendMyr === undefined) {
		return null;
	}
	return Math.round(parsed.data.minSpendMyr * MINOR_UNITS_PER_MAJOR);
}

/**
 * Whether a reward may be redeemed at the store a POS request comes from.
 * `locationId === null` means the store is unknown (an organization-wide key
 * on a terminal that was never registered to a store) — there is nothing to
 * narrow against, so only an explicit mismatch is refused.
 */
export function isRewardValidAtStore(reward: Pick<RewardClaimRedemptionLookup["reward"], "locationScopeType" | "locationIds">, locationId: string | null): boolean {
	if (reward.locationScopeType === "ALL_LOCATIONS" || locationId === null) {
		return true;
	}
	return reward.locationIds.includes(locationId);
}

export interface RedemptionEligibilityInput {
	readonly lookup: RewardClaimRedemptionLookup;
	/** The store of the POS request (`null` = unknown). */
	readonly locationId: string | null;
	/** The customer read out the backup code instead of showing the QR. */
	readonly usedBackupCode: boolean;
	readonly now: number;
}

/** Why the claim cannot be redeemed now, or `null` when it can. Merchant ownership is checked separately (it is not a POS-displayable state). */
export function redemptionInvalidReason({ lookup, locationId, usedBackupCode, now }: RedemptionEligibilityInput): RedemptionInvalidReason | null {
	const { claim, reward } = lookup;
	if (claim.status === "REDEEMED") {
		return "ALREADY_REDEEMED";
	}
	if (claim.status === "EXPIRED" || Number(claim.claimExpiresAt) < now) {
		return "EXPIRED";
	}
	if (usedBackupCode && claim.backupLockedUntil !== null && Number(claim.backupLockedUntil) > now) {
		return "BACKUP_LOCKED";
	}
	if (!isRewardValidAtStore(reward, locationId)) {
		return "NOT_VALID_AT_STORE";
	}
	return null;
}

/**
 * Fingerprint of a checkout's payload: a retried idempotency key must carry
 * the same bill and codes to be replayed (codes are hashed, never stored).
 */
export function checkoutRequestHash(input: RedemptionCheckoutInput): string {
	const canonical = JSON.stringify({
		billTotalMinor: input.billTotalMinor,
		currency: input.currency,
		codes: input.codes.map((code) => ({ token: code.token ?? null, backupCode: code.backupCode ?? null })),
	});
	return sha256Hex(canonical);
}

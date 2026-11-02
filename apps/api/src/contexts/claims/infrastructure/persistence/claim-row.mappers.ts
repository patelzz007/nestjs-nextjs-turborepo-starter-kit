import type { RewardClaim as RewardClaimRow } from "@prisma/client";
import { EpochMsSchema, type EpochMs, type RewardClaimResponse } from "@workspace/shared";

import type { RewardClaimState } from "../../domain/aggregates/reward-claim.aggregate";

function epochOf(value: bigint): EpochMs {
	return EpochMsSchema.parse(Number(value));
}

function epochOrNull(value: bigint | null): EpochMs | null {
	return value === null ? null : epochOf(value);
}

/** A stored claim row as the aggregate's state (the aggregate validates the status on rehydrate). */
export function toRewardClaimState(row: RewardClaimRow): RewardClaimState {
	return {
		id: row.id,
		userId: row.userId,
		rewardId: row.rewardId,
		referralId: row.referralId,
		status: row.status,
		isReferrerCredit: row.isReferrerCredit,
		claimedAt: epochOf(row.claimedAt),
		claimExpiresAt: epochOf(row.claimExpiresAt),
		redeemedAt: epochOrNull(row.redeemedAt),
		codes: { redemptionTokenHash: row.redemptionTokenHash, backupCodeHash: row.backupCodeHash },
	};
}

/** A claim as the API returns it, with the claimed reward's title. It never carries the code hashes. */
export function toRewardClaimResponse(row: RewardClaimRow, rewardTitle: string): RewardClaimResponse {
	return {
		id: row.id,
		rewardId: row.rewardId,
		rewardTitle,
		status: row.status,
		claimedAt: epochOf(row.claimedAt),
		claimExpiresAt: epochOf(row.claimExpiresAt),
		redeemedAt: epochOrNull(row.redeemedAt),
		isReferrerCredit: row.isReferrerCredit,
		createdAt: epochOf(row.createdAt),
		updatedAt: epochOf(row.updatedAt),
		isDeleted: row.isDeleted,
		deletedAt: epochOrNull(row.deletedAt),
	};
}

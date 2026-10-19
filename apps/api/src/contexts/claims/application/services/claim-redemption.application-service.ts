import type { EpochMs, RedemptionCode } from "@workspace/shared";

import type { TransactionalEventCollector } from "../../../../platform/application/events/transactional-event-collector";
import type { RewardRedemptionFactsPort } from "../../../rewards/public-api";
import { ClaimNoLongerRedeemableError } from "../../domain/errors/claims.errors";
import type { RewardClaimRepository } from "../../domain/repositories/claims.repositories";
import type { ClaimCodesPort } from "../ports/claim-codes.port";
import type { ClaimRedemptionLookup, ClaimRedemptionPort } from "../ports/claim-redemption.port";

/** Finds a claim by one of its code hashes (every key version of the hasher). */
export interface ClaimCodeLookup {
	findByRedemptionTokenHash(hashes: readonly string[]): Promise<string | null>;
	findByBackupCodeHash(hashes: readonly string[]): Promise<string | null>;
	rewardIdsOf(claimIds: readonly string[]): Promise<ReadonlyMap<string, string>>;
}

/**
 * {@link ClaimRedemptionPort} over the RewardClaim aggregate. `events` is the caller's (checkout's)
 * collector: each redeemed claim's `ClaimRedeemed` is dispatched with the sale's own events.
 */
export class ClaimRedemptionApplicationService implements ClaimRedemptionPort {
	public constructor(
		private readonly claims: RewardClaimRepository,
		private readonly lookups: ClaimCodeLookup,
		private readonly rewards: RewardRedemptionFactsPort,
		private readonly codes: ClaimCodesPort,
		private readonly events: TransactionalEventCollector,
	) {}

	public async findMerchantClaim(code: RedemptionCode, organizationId: string): Promise<ClaimRedemptionLookup | null> {
		const claimId =
			code.token !== undefined
				? await this.lookups.findByRedemptionTokenHash(this.codes.lookupCandidates(code.token))
				: code.backupCode !== undefined
					? await this.lookups.findByBackupCodeHash(this.codes.lookupCandidates(code.backupCode))
					: null;
		const claim = claimId === null ? null : await this.claims.findById(claimId);
		if (claim === null) {
			return null;
		}
		const reward = await this.rewards.factsFor(claim.rewardId);
		if (reward?.organizationId !== organizationId) {
			return null;
		}
		return { claim: { id: claim.id, userId: claim.userId, rewardId: claim.rewardId, status: claim.currentStatus, claimExpiresAt: claim.claimExpiresAt }, reward };
	}

	public async rewardIdsOf(claimIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
		return claimIds.length === 0 ? new Map() : this.lookups.rewardIdsOf(claimIds);
	}

	public async redeem(claimIds: readonly string[], paidAt: EpochMs): Promise<void> {
		for (const claimId of [...claimIds].sort((left, right) => left.localeCompare(right))) {
			const claim = await this.claims.findById(claimId);
			if (claim?.isRedeemableAt(paidAt) !== true) {
				throw new ClaimNoLongerRedeemableError(claimId);
			}
			claim.redeem(paidAt);
			if (!(await this.claims.saveIfUnchanged(claim))) {
				throw new ClaimNoLongerRedeemableError(claimId);
			}
			this.events.collectFrom(claim);
		}
	}
}

import type { Prisma } from "@prisma/client";
import { nowEpochMs, type EpochMs } from "@workspace/shared";

import type { ClaimCodeLookup } from "../../application/services/claim-redemption.application-service";
import { RewardClaim } from "../../domain/aggregates/reward-claim.aggregate";
import { ClaimNotActiveError, ClaimNotFoundError } from "../../domain/errors/claims.errors";
import type { OverdueClaim, RewardClaimRepository } from "../../domain/repositories/claims.repositories";
import { LIMIT_COUNTED_CLAIM_STATUSES } from "../../domain/value-objects/claim-rules.value-object";
import { toRewardClaimState } from "./claim-row.mappers";

/** Reward claims on one unit-of-work transaction. Writes compare-and-set on the status the aggregate was loaded with. */
export class PrismaRewardClaimRepository implements RewardClaimRepository, ClaimCodeLookup {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async add(claim: RewardClaim): Promise<void> {
		const state = claim.snapshot();
		await this.db.rewardClaim.create({
			data: {
				id: state.id,
				userId: state.userId,
				rewardId: state.rewardId,
				referralId: state.referralId,
				redemptionTokenHash: state.codes.redemptionTokenHash,
				backupCodeHash: state.codes.backupCodeHash,
				status: state.status,
				isReferrerCredit: state.isReferrerCredit,
				claimedAt: state.claimedAt,
				claimExpiresAt: state.claimExpiresAt,
				redeemedAt: state.redeemedAt,
			},
		});
	}

	/** The user's own live claim; anyone else's (or a missing one) is not found. */
	public async getForUser(claimId: string, userId: string): Promise<RewardClaim> {
		const row = await this.db.rewardClaim.findFirst({ where: { id: claimId, userId, isDeleted: false } });
		if (row === null) {
			throw new ClaimNotFoundError(claimId);
		}
		return RewardClaim.rehydrate(toRewardClaimState(row));
	}

	public async findById(claimId: string): Promise<RewardClaim | null> {
		const row = await this.db.rewardClaim.findFirst({ where: { id: claimId, isDeleted: false } });
		return row === null ? null : RewardClaim.rehydrate(toRewardClaimState(row));
	}

	public async findReferrerCredit(referralId: string): Promise<RewardClaim | null> {
		const row = await this.db.rewardClaim.findFirst({ where: { referralId, isReferrerCredit: true, isDeleted: false }, orderBy: { id: "asc" } });
		return row === null ? null : RewardClaim.rehydrate(toRewardClaimState(row));
	}

	/** Claims that count toward the per-customer limit (an expired claim returned its unit and does not). */
	public async countHeld(userId: string, rewardId: string): Promise<number> {
		return this.db.rewardClaim.count({ where: { userId, rewardId, isDeleted: false, status: { in: [...LIMIT_COUNTED_CLAIM_STATUSES] } } });
	}

	public async listOverdue(isReferrerCredit: boolean, now: EpochMs, take: number): Promise<readonly OverdueClaim[]> {
		const rows = await this.db.rewardClaim.findMany({
			where: { status: "PENDING", isReferrerCredit, isDeleted: false, claimExpiresAt: { lt: now } },
			orderBy: [{ claimExpiresAt: "asc" }, { id: "asc" }],
			take,
			select: { id: true, reward: { select: { tenantId: true } } },
		});
		return rows.map((row): OverdueClaim => ({ claimId: row.id, tenantId: row.reward.tenantId }));
	}

	/** Writes the claim, or refuses (`ClaimNotActiveError`) when it moved meanwhile (redeemed, expired). */
	public async save(claim: RewardClaim): Promise<void> {
		if (!(await this.saveIfUnchanged(claim))) {
			throw new ClaimNotActiveError(claim.id);
		}
	}

	/**
	 * Compare-and-set on the loaded status, and on the expiry when the change needs a live claim
	 * (`mustBeLiveAt`): a concurrent redemption, expiry or code rotation makes this answer `false`.
	 */
	public async saveIfUnchanged(claim: RewardClaim): Promise<boolean> {
		const state = claim.snapshot();
		const loaded = claim.concurrencyToken;
		if (loaded === null) {
			throw new ClaimNotFoundError(claim.id);
		}
		const liveAt: EpochMs | null = claim.mustBeLiveAt;
		const updated = await this.db.rewardClaim.updateMany({
			where: { id: state.id, isDeleted: false, status: loaded, ...(liveAt === null ? {} : { claimExpiresAt: { gte: liveAt } }) },
			data: {
				status: state.status,
				redemptionTokenHash: state.codes.redemptionTokenHash,
				backupCodeHash: state.codes.backupCodeHash,
				redeemedAt: state.redeemedAt,
				updatedAt: nowEpochMs(),
			},
		});
		return updated.count === 1;
	}

	public async findByRedemptionTokenHash(hashes: readonly string[]): Promise<string | null> {
		const row = await this.db.rewardClaim.findFirst({ where: { redemptionTokenHash: { in: [...hashes] }, isDeleted: false }, select: { id: true } });
		return row?.id ?? null;
	}

	public async rewardIdsOf(claimIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
		const rows = await this.db.rewardClaim.findMany({ where: { id: { in: [...new Set(claimIds)] } }, select: { id: true, rewardId: true } });
		return new Map(rows.map((row): [string, string] => [row.id, row.rewardId]));
	}

	public async findByBackupCodeHash(hashes: readonly string[]): Promise<string | null> {
		const row = await this.db.rewardClaim.findFirst({ where: { backupCodeHash: { in: [...hashes] }, isDeleted: false }, select: { id: true } });
		return row?.id ?? null;
	}
}

import { Injectable } from "@nestjs/common";
import type { Prisma, RewardReferral } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";

export interface ReferrerCreditInput {
	/** The reward the referee just redeemed (the referral's reward). */
	readonly rewardId: string;
	readonly refereeUserId: string;
	readonly now: number;
	/** sha256 of the referrer claim's fresh QR token / backup code (the plaintexts are re-issued when the referrer opens the QR). */
	readonly redemptionTokenHash: string;
	readonly backupCodeHash: string;
	readonly claimTtlMs: number;
	readonly claimTtlDays: number;
}

/** A referral this checkout credited. */
export interface CreditedReferral {
	readonly referralId: string;
	readonly referrerUserId: string;
	readonly referrerRewardId: string;
}

/** A credited referral whose email is still to be delivered. */
export interface PendingCreditNotification {
	readonly referralId: string;
	readonly referrerEmail: string;
	/** Title of the reward the referrer was credited with (from the credit claim, which always keeps its reward). */
	readonly referrerRewardTitle: string;
}

/** The referrer's address and the reward of the credit claim (`isReferrerCredit`) this referral earned. */
const CREDIT_NOTIFICATION_SELECT = {
	id: true,
	referrerUser: { select: { email: true } },
	claims: { where: { isReferrerCredit: true }, select: { reward: { select: { title: true } } }, take: 1 },
} satisfies Prisma.RewardReferralSelect;

type CreditNotificationRow = Prisma.RewardReferralGetPayload<{ select: typeof CREDIT_NOTIFICATION_SELECT }>;

/** A CREDITED referral always has its credit claim (both are written in one transaction). */
export class ReferrerCreditClaimMissingError extends Error {
	public constructor(referralId: string) {
		super(`Referral ${referralId} is CREDITED but has no referrer credit claim`);
		this.name = "ReferrerCreditClaimMissingError";
	}
}

function toPendingCreditNotification(row: CreditNotificationRow): PendingCreditNotification {
	const [creditClaim] = row.claims;
	if (creditClaim === undefined) {
		throw new ReferrerCreditClaimMissingError(row.id);
	}
	return { referralId: row.id, referrerEmail: row.referrerUser.email, referrerRewardTitle: creditClaim.reward.title };
}

export type RewardReferralWithReward = Prisma.RewardReferralGetPayload<{
	include: {
		reward: true;
	};
}>;

@Injectable()
export class RewardReferralRepository {
	public constructor(private readonly prisma: PrismaService) {}

	/** `rewardScope` narrows to the rewards the caller's stores offer (`{}` = every reward of the organization). */
	public async countByMerchantOrg(
		organizationId: string,
		createdAtRange: { readonly gte: number; readonly lte: number },
		rewardScope: Prisma.RewardWhereInput,
	): Promise<number> {
		return this.prisma.rewardReferral.count({
			where: {
				isDeleted: false,
				createdAt: createdAtRange,
				reward: { AND: [{ organizationId, isDeleted: false }, rewardScope] },
			},
		});
	}

	public async listForReferrerAnalytics(
		referrerUserId: string,
		createdAtRange: { readonly gte: number; readonly lte: number },
	): Promise<Pick<RewardReferral, "createdAt" | "status">[]> {
		return this.prisma.rewardReferral.findMany({
			where: {
				referrerUserId,
				isDeleted: false,
				createdAt: createdAtRange,
			},
			select: { createdAt: true, status: true },
		});
	}

	/**
	 * Credits the referrer whose invite led `refereeUserId` to claim `rewardId`,
	 * INSIDE the caller's checkout transaction — the credit commits (or rolls
	 * back) with the redemption that earned it, so a retried checkout can
	 * never redeem without crediting, nor credit twice.
	 *
	 * Every step is a conditional update that row-locks what it touches until
	 * the transaction ends: the referral (PENDING → CREDITED), the parent
	 * reward's referral pool (> 0) and the referrer reward's stock (> 0). If a
	 * later step finds nothing left, the earlier steps are undone on the rows
	 * this transaction still holds locked, and the referral stays PENDING.
	 * Returns `null` when there is nothing to credit.
	 */
	public async creditReferrerForRedemption(tx: Prisma.TransactionClient, input: ReferrerCreditInput): Promise<CreditedReferral | null> {
		const referral = await tx.rewardReferral.findFirst({
			where: { rewardId: input.rewardId, refereeUserId: input.refereeUserId, status: "PENDING", isDeleted: false },
			select: { id: true, referrerUserId: true },
		});
		if (referral === null) {
			return null;
		}
		const parent = await tx.reward.findUnique({
			where: { id: input.rewardId },
			select: { referrerReward: { select: { id: true, title: true, expiryDate: true, isDeleted: true } } },
		});
		const referrerReward = parent?.referrerReward ?? null;
		if (referrerReward === null || referrerReward.isDeleted) {
			return null;
		}

		const credited = await tx.rewardReferral.updateMany({
			where: { id: referral.id, status: "PENDING" },
			data: { status: "CREDITED", creditedAt: input.now },
		});
		if (credited.count === 0) {
			return null;
		}

		const pool = await tx.reward.updateMany({
			where: { id: input.rewardId, referralPoolRemaining: { gt: 0 } },
			data: { referralPoolRemaining: { decrement: 1 } },
		});
		if (pool.count === 0) {
			await this.revertCredit(tx, referral.id);
			return null;
		}

		const reserved = await tx.reward.updateMany({
			where: { id: referrerReward.id, isDeleted: false, quantityRemaining: { gt: 0 } },
			data: { quantityRemaining: { decrement: 1 }, quantityReserved: { increment: 1 }, claimCount: { increment: 1 } },
		});
		if (reserved.count === 0) {
			await tx.reward.update({ where: { id: input.rewardId }, data: { referralPoolRemaining: { increment: 1 } } });
			await this.revertCredit(tx, referral.id);
			return null;
		}

		const claimExpiresAt = Math.min(input.now + input.claimTtlMs, Number(referrerReward.expiryDate));
		await tx.rewardClaim.create({
			data: {
				userId: referral.referrerUserId,
				rewardId: referrerReward.id,
				referralId: referral.id,
				redemptionTokenHash: input.redemptionTokenHash,
				backupCodeHash: input.backupCodeHash,
				status: "PENDING",
				isReferrerCredit: true,
				claimedAt: input.now,
				claimExpiresAt,
			},
		});
		// Insert without reading the row back: a POS key may notify its organization's referrers but
		// never read their inbox, and `create()`'s `RETURNING` is checked against SELECT policies.
		await tx.rewardNotification.createMany({
			data: [
				{
					userId: referral.referrerUserId,
					type: "referrer_reward_credited",
					title: "You earned a referrer reward!",
					body: `Your referral redeemed a reward. Claim "${referrerReward.title}" within ${String(input.claimTtlDays)} days.`,
					metadata: { rewardId: referrerReward.id },
				},
			],
		});

		return { referralId: referral.id, referrerUserId: referral.referrerUserId, referrerRewardId: referrerReward.id };
	}

	/**
	 * CREDITED referrals whose "reward credited" email has not been handed to
	 * the mailer yet (oldest credit first) — the delivery job's work queue.
	 */
	public async listPendingCreditNotifications(take: number): Promise<PendingCreditNotification[]> {
		const rows = await this.prisma.rewardReferral.findMany({
			where: { status: "CREDITED", creditNotifiedAt: null, isDeleted: false },
			orderBy: { creditedAt: "asc" },
			take,
			select: CREDIT_NOTIFICATION_SELECT,
		});
		return rows.map(toPendingCreditNotification);
	}

	/** Same as {@link listPendingCreditNotifications}, for one referral (`null` when already delivered or not credited). */
	public async findPendingCreditNotification(referralId: string): Promise<PendingCreditNotification | null> {
		const row = await this.prisma.rewardReferral.findFirst({
			where: { id: referralId, status: "CREDITED", creditNotifiedAt: null, isDeleted: false },
			select: CREDIT_NOTIFICATION_SELECT,
		});
		return row === null ? null : toPendingCreditNotification(row);
	}

	/** Marks the email as handed to the mailer; `false` when another worker already did. */
	public async markCreditNotified(referralId: string, notifiedAt: number): Promise<boolean> {
		const updated = await this.prisma.rewardReferral.updateMany({
			where: { id: referralId, creditNotifiedAt: null },
			data: { creditNotifiedAt: notifiedAt },
		});
		return updated.count === 1;
	}

	private async revertCredit(tx: Prisma.TransactionClient, referralId: string): Promise<void> {
		await tx.rewardReferral.update({ where: { id: referralId }, data: { status: "PENDING", creditedAt: null } });
	}
}

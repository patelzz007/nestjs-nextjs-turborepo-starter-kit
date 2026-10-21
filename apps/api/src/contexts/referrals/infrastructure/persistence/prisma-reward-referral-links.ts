import type { Prisma } from "@prisma/client";

import type { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import type {
	NewReferralLink,
	ReferableRewardLookupPort,
	RefereeAttributionPort,
	RewardReferralLinkScope,
	RewardReferralLinkTransactions,
} from "../../application/ports/reward-referral-links.port";
import { CREATE_REWARD_REFERRAL_LINK_OPERATION, RECORD_REWARD_REFERRAL_ATTRIBUTION_OPERATION } from "../../application/ports/referrals.tokens";
import type { AttributableReferralLink } from "../../domain/policies/reward-referral-link.policy";

/** `ReferableRewardLookupPort` for one transaction: what rewards provides under `REFERABLE_REWARD_LOOKUP_FACTORY`. */
export interface ReferableRewardLookupFactory {
	forTransaction(db: Prisma.TransactionClient): ReferableRewardLookupPort;
}

/** `RefereeAttributionPort` for one transaction: what identity provides under `REFEREE_ATTRIBUTION_FACTORY`. */
export interface RefereeAttributionFactory {
	forTransaction(db: Prisma.TransactionClient): RefereeAttributionPort;
}

/** The capability the link commands need of the transaction service: named system-operation transactions. */
export type ReferralLinkSystemTransactions = Pick<TenantTransactionService, "withSystemOperation">;

/** `RewardReferral` reads and writes of the link commands, on their transaction. */
class PrismaRewardReferralLinkScope implements RewardReferralLinkScope {
	public readonly rewards: ReferableRewardLookupPort;
	public readonly referees: RefereeAttributionPort;

	public constructor(
		private readonly db: Prisma.TransactionClient,
		rewards: ReferableRewardLookupFactory,
		referees: RefereeAttributionFactory,
	) {
		this.rewards = rewards.forTransaction(db);
		this.referees = referees.forTransaction(db);
	}

	public async lockReferrer(referrerUserId: string): Promise<boolean> {
		// FOR UPDATE: two link requests of one referrer serialize here, so the second counts the first's row.
		return (await this.db.$executeRaw`SELECT id FROM "User" WHERE id = ${referrerUserId} AND "isDeleted" = false FOR UPDATE`) === 1;
	}

	public countOpenLinks(referrerUserId: string, rewardId: string): Promise<number> {
		return this.db.rewardReferral.count({ where: { referrerUserId, rewardId, status: "PENDING", refereeUserId: null, isDeleted: false } });
	}

	public async insertLink(link: NewReferralLink): Promise<void> {
		await this.db.rewardReferral.create({
			data: {
				id: link.referralId,
				referrerUserId: link.referrerUserId,
				rewardId: link.rewardId,
				attributionToken: link.attributionToken,
				status: "PENDING",
				createdAt: link.now,
				createdBy: link.referrerUserId,
				updatedAt: link.now,
				updatedBy: link.referrerUserId,
			},
		});
	}

	public async findLink(attributionToken: string): Promise<AttributableReferralLink | null> {
		const row = await this.db.rewardReferral.findFirst({
			where: { attributionToken, status: "PENDING", isDeleted: false },
			select: { rewardId: true, referrerUserId: true, refereeUserId: true },
		});
		return row === null ? null : { rewardId: row.rewardId, referrerUserId: row.referrerUserId, refereeUserId: row.refereeUserId };
	}
}

/**
 * Both link commands run as named system operations: `RewardReferral` is bypass-write under RLS (a
 * referee may not write a referrer's row), so each command's tables are listed in the registry
 * and nothing else is reachable.
 */
export class PrismaRewardReferralLinkTransactions implements RewardReferralLinkTransactions {
	public constructor(
		private readonly transactions: ReferralLinkSystemTransactions,
		private readonly rewards: ReferableRewardLookupFactory,
		private readonly referees: RefereeAttributionFactory,
	) {}

	public createLink<T>(actorUserId: string, work: (scope: RewardReferralLinkScope) => Promise<T>): Promise<T> {
		return this.transactions.withSystemOperation({ operation: CREATE_REWARD_REFERRAL_LINK_OPERATION, reason: "Mint a reward referral link", actorUserId }, (tx) =>
			work(new PrismaRewardReferralLinkScope(tx, this.rewards, this.referees)),
		);
	}

	public recordAttribution<T>(actorUserId: string, work: (scope: RewardReferralLinkScope) => Promise<T>): Promise<T> {
		return this.transactions.withSystemOperation(
			{ operation: RECORD_REWARD_REFERRAL_ATTRIBUTION_OPERATION, reason: "Record a referee's reward referral attribution", actorUserId },
			(tx) => work(new PrismaRewardReferralLinkScope(tx, this.rewards, this.referees)),
		);
	}
}

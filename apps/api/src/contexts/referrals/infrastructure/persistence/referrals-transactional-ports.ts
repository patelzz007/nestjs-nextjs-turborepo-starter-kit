import type { Prisma } from "@prisma/client";
import { epochMs, nowEpochMs, type EpochMs } from "@workspace/shared";

import type { TransactionalEventCollector } from "../../../../platform/application/events/transactional-event-collector";
import { SignupReferralCodeError } from "../../application/errors/signup-referral.errors";
import type { ReferralBonusStockPort, ReferralCreditPort } from "../../application/ports/referral-credit.port";
import type { ReferrerCreditCursor, ReferrerCreditNoticesPort, UnnotifiedReferrerCredit } from "../../application/ports/referrer-credit-notices.port";
import type { RewardReferralAttributionPort } from "../../application/ports/reward-referral-attribution.port";
import type { ClaimedSignupSuccessNotice, OwedSignupSuccessNotice, SignupSuccessNoticesPort } from "../../application/ports/signup-success-notices.port";
import type { AcceptedSignupReferral, TransactionalSignupReferralPort } from "../../application/ports/signup-referral.port";
import { ReferralCreditApplicationService } from "../../application/services/referral-credit.application-service";
import type { SignupReferralSuccessRepository } from "../../domain/repositories/referral.repositories";
import { PrismaRewardReferralRepository } from "./prisma-reward-referral.repository";
import { evaluateSignupReferralCode } from "../../domain/policies/signup-referral-code-validity.policy";
import { findCodeForValidation } from "./signup-referral.queries";
import { issueSignupReferralCode } from "./signup-referral-code.issuer";

/** The checkout's signup-referral success stamp (ADR 035, "Success") on one transaction. */
class PrismaSignupReferralSuccessRepository implements SignupReferralSuccessRepository {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async markSuccessful(refereeUserId: string, paidAt: EpochMs): Promise<string | null> {
		const referral = await this.db.signupReferral.findFirst({ where: { refereeUserId, isDeleted: false, successfulAt: null }, select: { id: true } });
		if (referral === null) {
			return null;
		}
		const updated = await this.db.signupReferral.updateMany({
			where: { id: referral.id, isDeleted: false, successfulAt: null },
			data: { successfulAt: BigInt(paidAt), updatedAt: BigInt(paidAt) },
		});
		return updated.count === 1 ? referral.id : null;
	}
}

/** Referrals' ports bound to ANOTHER context's transaction (§5.4 cross-context scopes). */
export interface ReferralsTransactionalPorts {
	readonly signupReferrals: TransactionalSignupReferralPort;
	readonly rewardReferralAttribution: RewardReferralAttributionPort;
	readonly referrerCreditNotices: ReferrerCreditNoticesPort;
	readonly signupSuccessNotices: SignupSuccessNoticesPort;
}

/**
 * The checkout's `ReferralCreditPort` on `db`, the checkout's transaction. `bonusStock` is rewards'
 * inventory bound to that same transaction; `events` is the checkout's collector, which carries
 * `ReferrerCredited` / `SignupReferralSucceeded` to their handlers. Only your `infrastructure/` may call it.
 */
export function createReferralCreditPort(db: Prisma.TransactionClient, events: TransactionalEventCollector, bonusStock: ReferralBonusStockPort): ReferralCreditPort {
	return new ReferralCreditApplicationService(new PrismaRewardReferralRepository(db), new PrismaSignupReferralSuccessRepository(db), bonusStock, events);
}

/**
 * Build referrals' transactional ports on `db`, the caller's transaction: identity's signup and
 * provisioning (first code, signup referral), claims' attribution of a referee's claim, its
 * referrer-credit emails and its signup-success notices. New instances every call.
 */
export function createReferralsTransactionalPorts(db: Prisma.TransactionClient): ReferralsTransactionalPorts {
	return {
		signupReferrals: {
			async issueFirstCode(userId: string, now: number): Promise<void> {
				await issueSignupReferralCode(db, userId, now);
			},
			/**
			 * The owner row is locked (`FOR SHARE`) and the code re-validated on `db` at that instant: a
			 * deactivation, deletion or successor insert that committed after the pre-signup check is seen
			 * here, and one that has not committed waits for this transaction.
			 */
			async attachSignupReferral(accepted: AcceptedSignupReferral, referee: { readonly id: string; readonly createdAt: number }): Promise<void> {
				const ownerLocked = (await db.$executeRaw`SELECT id FROM "User" WHERE id = ${accepted.referrerUserId} FOR SHARE`) === 1;
				if (accepted.referrerUserId === referee.id || !ownerLocked) {
					throw new SignupReferralCodeError("unavailable");
				}
				const validity = evaluateSignupReferralCode(await findCodeForValidation(db, accepted.canonical), nowEpochMs());
				if (validity.kind === "rejected") {
					throw new SignupReferralCodeError(validity.rejection);
				}
				await db.signupReferral.create({
					data: { referrerUserId: validity.referrerUserId, refereeUserId: referee.id, referralCodeId: validity.referralCodeId, createdAt: BigInt(referee.createdAt) },
				});
			},
		},
		rewardReferralAttribution: {
			/**
			 * Compare-and-set: a PENDING referral is attached to its first referee only (or re-attached to
			 * the same one, who claims again after an expiry); another user presenting the same token
			 * never takes it over.
			 */
			async attachReferee(attributionToken: string, rewardId: string, refereeUserId: string): Promise<string | null> {
				const unattachedOrSame: Prisma.RewardReferralWhereInput = {
					attributionToken,
					rewardId,
					status: "PENDING",
					isDeleted: false,
					OR: [{ refereeUserId: null }, { refereeUserId }],
				};
				const referral = await db.rewardReferral.findFirst({ where: unattachedOrSame, select: { id: true } });
				if (referral === null) {
					return null;
				}
				const updated = await db.rewardReferral.updateMany({ where: { ...unattachedOrSame, id: referral.id }, data: { refereeUserId } });
				return updated.count === 1 ? referral.id : null;
			},
		},
		referrerCreditNotices: {
			async listUnnotified(take: number, after: ReferrerCreditCursor | null): Promise<readonly UnnotifiedReferrerCredit[]> {
				const rows = await db.rewardReferral.findMany({
					where: {
						status: "CREDITED",
						creditNotifiedAt: null,
						creditedAt: { not: null },
						isDeleted: false,
						...(after === null ? {} : { OR: [{ creditedAt: { gt: after.creditedAt } }, { creditedAt: after.creditedAt, id: { gt: after.referralId } }] }),
					},
					orderBy: [{ creditedAt: "asc" }, { id: "asc" }],
					take,
					select: { id: true, referrerUserId: true, creditedAt: true },
				});
				return rows.flatMap((row): UnnotifiedReferrerCredit[] =>
					row.creditedAt === null ? [] : [{ referralId: row.id, referrerUserId: row.referrerUserId, creditedAt: epochMs(Number(row.creditedAt)) }],
				);
			},
			async markNotified(referralId: string, notifiedAt: EpochMs): Promise<boolean> {
				const updated = await db.rewardReferral.updateMany({
					where: { id: referralId, status: "CREDITED", creditNotifiedAt: null, isDeleted: false },
					data: { creditNotifiedAt: notifiedAt, updatedAt: notifiedAt },
				});
				return updated.count === 1;
			},
		},
		signupSuccessNotices: {
			async listOwed(take: number, after: OwedSignupSuccessNotice | null): Promise<readonly OwedSignupSuccessNotice[]> {
				const owed: Prisma.SignupReferralWhereInput = { isDeleted: false, successfulAt: { not: null }, successNotifiedAt: null };
				const rows = await db.signupReferral.findMany({
					where:
						after === null
							? owed
							: { AND: [owed, { OR: [{ successfulAt: { gt: after.successfulAt } }, { successfulAt: after.successfulAt, id: { gt: after.signupReferralId } }] }] },
					orderBy: [{ successfulAt: "asc" }, { id: "asc" }],
					take,
					select: { id: true, successfulAt: true },
				});
				return rows.flatMap((row): OwedSignupSuccessNotice[] =>
					row.successfulAt === null ? [] : [{ signupReferralId: row.id, successfulAt: epochMs(Number(row.successfulAt)) }],
				);
			},
			async claim(signupReferralId: string, now: EpochMs): Promise<ClaimedSignupSuccessNotice | null> {
				// Exactly one concurrent deliverer matches; the losers see zero rows and write nothing.
				const claimed = await db.signupReferral.updateMany({
					where: { id: signupReferralId, isDeleted: false, successfulAt: { not: null }, successNotifiedAt: null },
					data: { successNotifiedAt: BigInt(now), updatedAt: BigInt(now) },
				});
				if (claimed.count !== 1) {
					return null;
				}
				return db.signupReferral.findUnique({ where: { id: signupReferralId }, select: { referrerUserId: true, refereeUserId: true } });
			},
		},
	};
}

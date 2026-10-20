import type { Prisma } from "@prisma/client";

import type { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import type { SignupReferralAuditPort } from "../../application/ports/signup-referral-audit.port";
import type { CodeMaintenanceOutcome, SignupReferralCodeMaintenancePort } from "../../application/ports/signup-referral-maintenance.port";
import { isSignupReferralCodeDue } from "../../domain/policies/signup-referral-dashboard.policy";
import { LATEST_CODE_ORDER } from "./signup-referral.queries";
import { issueSignupReferralCode } from "./signup-referral-code.issuer";
import { MAINTENANCE_SIGNUP_REFERRAL_CODES_OPERATION } from "../../application/ports/referrals.tokens";

/** The code job's audit trail bound to its transaction (rewards provides it under `SIGNUP_REFERRAL_AUDIT_FACTORY`). */
export interface SignupReferralAuditFactory {
	forTransaction(db: Prisma.TransactionClient): SignupReferralAuditPort;
}

/** The one capability the code job needs of the transaction service: named system-operation transactions. */
export type SystemOperationTransactions = Pick<TenantTransactionService, "withSystemOperation">;

/** The code job's persistence, each user in its own system-operation transaction under that user's row lock. */
export class PrismaSignupReferralCodeMaintenance implements SignupReferralCodeMaintenancePort {
	public constructor(
		private readonly transactions: SystemOperationTransactions,
		private readonly audit: SignupReferralAuditFactory,
	) {}

	/**
	 * Every code's `expiresAt` is its insert time plus the same TTL, so the latest code has the
	 * greatest `expiresAt` and "no code unexpired" is exactly "latest code missing or expired".
	 */
	public listUserIdsNeedingCode(now: number, limit: number, cursorId: string | null): Promise<readonly string[]> {
		return this.transactions.withSystemOperation(
			{ operation: MAINTENANCE_SIGNUP_REFERRAL_CODES_OPERATION, reason: "Find users whose signup referral code is missing or expired", actorUserId: null },
			async (tx): Promise<readonly string[]> => {
				const rows = await tx.user.findMany({
					where: {
						isDeleted: false,
						signupReferralCodes: { none: { isDeleted: false, expiresAt: { gt: BigInt(now) } } },
						...(cursorId === null ? {} : { id: { gt: cursorId } }),
					},
					orderBy: { id: "asc" },
					take: limit,
					select: { id: true },
				});
				return rows.map((row) => row.id);
			},
		);
	}

	public issueCodeIfDue(userId: string, now: number): Promise<CodeMaintenanceOutcome> {
		return this.transactions.withSystemOperation(
			{ operation: MAINTENANCE_SIGNUP_REFERRAL_CODES_OPERATION, reason: "Issue a signup referral code", actorUserId: null },
			async (tx): Promise<CodeMaintenanceOutcome> => {
				// FOR UPDATE: two job runs (one per replica) serialize on the user and the second re-reads the code the first inserted.
				if ((await tx.$executeRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`) !== 1) {
					return "skipped";
				}
				const user = await tx.user.findUnique({
					where: { id: userId },
					select: { isDeleted: true, signupReferralCodes: { where: { isDeleted: false }, orderBy: LATEST_CODE_ORDER, take: 1, select: { expiresAt: true } } },
				});
				const [latest] = user?.signupReferralCodes ?? [];
				const state = user === null ? null : { isDeleted: user.isDeleted, latestExpiresAt: latest === undefined ? null : Number(latest.expiresAt) };
				if (!isSignupReferralCodeDue(state, now)) {
					return "skipped";
				}
				const successor = state.latestExpiresAt !== null;
				const issued = await issueSignupReferralCode(tx, userId, now);
				await this.audit.forTransaction(tx).recordCodeIssued({ ownerUserId: userId, referralCodeId: issued.id, successor });
				return successor ? "successor" : "first";
			},
		);
	}
}

import type { Prisma } from "@prisma/client";

import type { IssuedSignupReferralCode, SignupReferralAuditFactory, SignupReferralAuditPort } from "../../../referrals/public-api";
import type { RewardAuditPort } from "../../application/ports/rewards-transactional.ports";
import { PrismaRewardAuditWriter } from "../persistence/prisma-reward-transactional.adapters";

/** `RewardAuditLog.action` of every code the signup-referral code job issues (ADR 035, "Authorization and audit"). */
export const SIGNUP_REFERRAL_CODE_ISSUED_AUDIT_ACTION = "signup_referral.code_issued";

/** Referrals' code-job audit, written to the rewards-family audit trail (rewards owns `RewardAuditLog`). */
export class RewardAuditSignupReferralAudit implements SignupReferralAuditPort {
	public constructor(private readonly audit: RewardAuditPort) {}

	/** The owner and the new row id, never the code value (operators read that from the code row). */
	public async recordCodeIssued(issued: IssuedSignupReferralCode): Promise<void> {
		await this.audit.append({
			tenantId: null,
			actorUserId: null,
			action: SIGNUP_REFERRAL_CODE_ISSUED_AUDIT_ACTION,
			metadata: { actor: "system", ownerUserId: issued.ownerUserId, referralCodeId: issued.referralCodeId, successor: issued.successor },
		});
	}
}

/** What rewards provides under referrals' `SIGNUP_REFERRAL_AUDIT_FACTORY`: the audit writer on the code job's own transaction. */
export const REWARD_AUDIT_SIGNUP_REFERRAL_AUDIT_FACTORY: SignupReferralAuditFactory = {
	forTransaction(db: Prisma.TransactionClient): SignupReferralAuditPort {
		return new RewardAuditSignupReferralAudit(new PrismaRewardAuditWriter(db));
	},
};

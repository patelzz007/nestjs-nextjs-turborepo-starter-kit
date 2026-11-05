import { systemOperationEraser, type ErasureSystemTransactions } from "../../../../platform/infrastructure/personal-data/erasure-helpers";
import type { PersonalDataEraser } from "../../../../platform/application/personal-data/personal-data-erasure.registry";

/** Referrals' part of erasure (ADR 077): the person's invite codes. The referrals themselves stay (the tombstone). */
export function referralsEraser(transactions: ErasureSystemTransactions): PersonalDataEraser {
	return systemOperationEraser("referrals", transactions, (tx, { userId }) => Promise.all([tx.signupReferralCode.deleteMany({ where: { userId } })]));
}

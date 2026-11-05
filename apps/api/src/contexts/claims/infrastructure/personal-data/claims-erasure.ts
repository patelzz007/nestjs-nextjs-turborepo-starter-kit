import { systemOperationEraser, type ErasureSystemTransactions } from "../../../../platform/infrastructure/personal-data/erasure-helpers";
import type { PersonalDataEraser } from "../../../../platform/application/personal-data/personal-data-erasure.registry";

/** Claims' part of erasure (ADR 077): one-time codes sent to the phone, reward notices; the referee IP cleared. Claims stay (the tombstone). */
export function claimsEraser(transactions: ErasureSystemTransactions): PersonalDataEraser {
	return systemOperationEraser("claims", transactions, (tx, { userId }) =>
		Promise.all([
			tx.rewardOtpChallenge.deleteMany({ where: { userId } }),
			tx.rewardNotification.deleteMany({ where: { userId } }),
			tx.rewardReferral.updateMany({ where: { refereeUserId: userId }, data: { refereeIp: null } }),
		]),
	);
}

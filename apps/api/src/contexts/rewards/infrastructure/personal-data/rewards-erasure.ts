import { systemOperationEraser, type ErasureSystemTransactions } from "../../../../platform/infrastructure/personal-data/erasure-helpers";
import type { PersonalDataEraser } from "../../../../platform/application/personal-data/personal-data-erasure.registry";

/** Rewards' part of erasure (ADR 077): the person is no longer in any offer's audience. */
export function rewardsEraser(transactions: ErasureSystemTransactions): PersonalDataEraser {
	return systemOperationEraser("rewards", transactions, (tx, { userId }) => Promise.all([tx.rewardAudienceMember.deleteMany({ where: { userId } })]));
}

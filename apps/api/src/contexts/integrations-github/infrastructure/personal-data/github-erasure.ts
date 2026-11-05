import { systemOperationEraser, type ErasureSystemTransactions } from "../../../../platform/infrastructure/personal-data/erasure-helpers";
import type { PersonalDataEraser } from "../../../../platform/application/personal-data/personal-data-erasure.registry";

/** GitHub's part of erasure (ADR 077): the linked account and its encrypted token. */
export function githubEraser(transactions: ErasureSystemTransactions): PersonalDataEraser {
	return systemOperationEraser("integrations-github", transactions, (tx, { userId }) => Promise.all([tx.githubAccountLink.deleteMany({ where: { userId } })]));
}

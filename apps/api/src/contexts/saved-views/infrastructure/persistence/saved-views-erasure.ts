import { systemOperationEraser, type ErasureSystemTransactions } from "../../../../platform/infrastructure/personal-data/erasure-helpers";
import type { PersonalDataEraser } from "../../../../platform/application/personal-data/personal-data-erasure.registry";

/** Saved views' part of erasure (ADR 077): the person's views go (soft-deleted), shared ones included. */
export function savedViewsEraser(transactions: ErasureSystemTransactions): PersonalDataEraser {
	return systemOperationEraser("saved-views", transactions, (tx, { userId }) =>
		Promise.all([tx.savedListView.updateMany({ where: { userId, isDeleted: false }, data: { isDeleted: true } })]),
	);
}

import { systemOperationEraser, type ErasureSystemTransactions } from "../../../../platform/infrastructure/personal-data/erasure-helpers";
import type { PersonalDataEraser } from "../../../../platform/application/personal-data/personal-data-erasure.registry";

/** Kanban's part of erasure (ADR 077): the person stops following tasks (never deleted: soft-deleted). Their work stays (the tombstone). */
export function kanbanEraser(transactions: ErasureSystemTransactions): PersonalDataEraser {
	return systemOperationEraser("kanban", transactions, (tx, { userId }) =>
		Promise.all([tx.kanbanTaskWatcher.updateMany({ where: { userId, isDeleted: false }, data: { isDeleted: true } })]),
	);
}

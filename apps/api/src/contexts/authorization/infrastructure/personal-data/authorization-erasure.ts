import { systemOperationEraser, type ErasureSystemTransactions } from "../../../../platform/infrastructure/personal-data/erasure-helpers";
import type { PersonalDataEraser } from "../../../../platform/application/personal-data/personal-data-erasure.registry";

/** Authorization's part of erasure (ADR 077): the account's platform roles and grants. */
export function authorizationEraser(transactions: ErasureSystemTransactions): PersonalDataEraser {
	return systemOperationEraser("authorization", transactions, (tx, { userId }) =>
		Promise.all([tx.userRole.deleteMany({ where: { userId } }), tx.userPermission.deleteMany({ where: { userId } })]),
	);
}

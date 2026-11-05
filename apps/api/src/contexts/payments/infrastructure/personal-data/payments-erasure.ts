import { systemOperationBlocker, type ErasureSystemTransactions } from "../../../../platform/infrastructure/personal-data/erasure-helpers";
import type { ErasureBlocker } from "../../../../platform/application/personal-data/personal-data-erasure.registry";

/** A payment still waiting for the person (as payer) blocks erasure until it is paid or closed (ADR 077). */
export function pendingPaymentBlocker(transactions: ErasureSystemTransactions): ErasureBlocker {
	return systemOperationBlocker("pending-payment", transactions, async (tx, _userId, email) => {
		const pending = await tx.paymentIntent.count({ where: { payerEmail: { equals: email, mode: "insensitive" }, status: "PENDING", isDeleted: false } });
		return pending > 0 ? "A payment you were asked for is still open. Pay it, or ask the business to cancel it, first." : null;
	});
}

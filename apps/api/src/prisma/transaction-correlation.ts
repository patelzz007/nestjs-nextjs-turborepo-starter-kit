import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { CorrelationIdSchema } from "../common/context/correlation-id";

/** The transaction delegate the correlation id is read through (the caller's interactive transaction). */
export type CorrelationTransaction = Pick<Prisma.TransactionClient, "$queryRaw">;

/** Thrown when a write that must carry a correlation id runs outside a `TenantTransactionService` transaction. */
export class MissingTransactionCorrelationIdError extends Error {
	public constructor() {
		super("This write must run inside a TenantTransactionService transaction (app.correlation_id is not set)");
		this.name = "MissingTransactionCorrelationIdError";
	}
}

/** `current_setting` returns '' for an unset custom setting; NULLIF turns that into NULL. */
const TransactionCorrelationRowsSchema = z.tuple([z.object({ correlation_id: CorrelationIdSchema.nullable() })]);

/**
 * The correlation id the current transaction runs under.
 *
 * `TenantTransactionService` stamps `app.correlation_id` (transaction-local) on
 * every tenant transaction and system operation: the request's id inside a
 * request, or the id it generated — and logged on the `rls.system_operation`
 * line — for background work. Reading it back from the transaction keeps that
 * decision in one place, so a row written here always carries the same id as
 * the request (or job) that wrote it. Outside such a transaction there is no id
 * to record, which is a programming error, not a NULL to store.
 */
export async function readTransactionCorrelationId(tx: CorrelationTransaction): Promise<string> {
	const rows = await tx.$queryRaw`SELECT NULLIF(current_setting('app.correlation_id', true), '') AS correlation_id`;
	const [row] = TransactionCorrelationRowsSchema.parse(rows);
	if (row.correlation_id === null) {
		throw new MissingTransactionCorrelationIdError();
	}
	return row.correlation_id;
}

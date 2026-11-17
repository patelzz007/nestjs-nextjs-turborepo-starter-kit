import type { Prisma } from "@prisma/client";

import type { SystemDatabaseContext } from "../../../prisma/tenant-context";

/**
 * What a context's feature flag fact source needs from `TenantTransactionService` (ADR 087): one short read under its
 * own named system operation. Kept in the platform so identity, tenancy and the flags context describe it once.
 */
export interface FlagFactTransactions {
	withSystemOperation<TResult>(context: SystemDatabaseContext, handler: (tx: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult>;
}

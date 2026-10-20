import type { Prisma } from "@prisma/client";

/** The unit-of-work transaction every tenants repository is bound to. */
export type TenantsDb = Prisma.TransactionClient;

/** Database bigint epoch columns → epoch milliseconds. */
export function epochOf(value: bigint): number {
	return Number(value);
}

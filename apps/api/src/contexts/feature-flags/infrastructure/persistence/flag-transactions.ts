import type { Prisma } from "@prisma/client";

import type { SystemDatabaseContext } from "../../../../prisma/tenant-context";

/** The one thing the flag stores need from `TenantTransactionService`: a transaction under a named system operation. */
export interface FlagTransactions {
	withSystemOperation<TResult>(context: SystemDatabaseContext, handler: (tx: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult>;
}

/** The catalogue version row's one key. */
const CATALOG_SCOPE = "catalog";
/** The version the first change raises the catalogue to (an untouched catalogue is version 0). */
const FIRST_VERSION = 1;
const NO_VERSION = 0;

/**
 * Raises the catalogue version in the caller's transaction and answers the new one, so a change and its version
 * commit together (the live stream announces the version only after the commit).
 */
export async function bumpCatalogVersion(tx: Prisma.TransactionClient): Promise<number> {
	const row = await tx.featureFlagCatalogVersion.upsert({
		where: { scope: CATALOG_SCOPE },
		create: { scope: CATALOG_SCOPE, version: FIRST_VERSION },
		update: { version: { increment: FIRST_VERSION } },
		select: { version: true },
	});
	return row.version;
}

/** The catalogue's current version (0 before any change). */
export async function readCatalogVersion(tx: Prisma.TransactionClient): Promise<number> {
	return (await tx.featureFlagCatalogVersion.findUnique({ where: { scope: CATALOG_SCOPE }, select: { version: true } }))?.version ?? NO_VERSION;
}

/** Ids a person's name is looked up by (`createdBy` / `updatedBy` hold user ids), to their names. */
export async function namesOf(tx: Prisma.TransactionClient, ids: readonly (string | null)[]): Promise<ReadonlyMap<string, string>> {
	const wanted = [...new Set(ids.flatMap((id) => (id === null ? [] : [id])))];
	const users = wanted.length === 0 ? [] : await tx.user.findMany({ where: { id: { in: wanted } }, select: { id: true, fullName: true } });
	return new Map(users.map((user): [string, string] => [user.id, user.fullName]));
}

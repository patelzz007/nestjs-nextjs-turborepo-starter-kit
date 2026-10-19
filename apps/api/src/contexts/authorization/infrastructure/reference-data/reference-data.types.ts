import type { Prisma } from "@prisma/client";

/** What one section changed. All zeros means the database already matched the catalog: nothing was written. */
export interface SectionChange {
	readonly created: number;
	readonly updated: number;
	readonly restored: number;
	readonly retired: number;
}

export const NO_CHANGE: SectionChange = { created: 0, updated: 0, restored: 0, retired: 0 };

export function changeCount(change: SectionChange): number {
	return change.created + change.updated + change.restored + change.retired;
}

/**
 * One independently committed slice of the reference data. A new kind of reference data is a new
 * section added to the list the sync is composed from — nothing else changes. A section reads what it
 * depends on from the database inside its own transaction, so sections never share in-memory state.
 */
export interface ReferenceDataSection {
	readonly name: string;
	sync(tx: Prisma.TransactionClient): Promise<SectionChange>;
}

/** Runs `handler` in ONE transaction (production: under the `reference_data.sync` system operation). */
export type ReferenceDataTransactionRunner = <T>(handler: (tx: Prisma.TransactionClient) => Promise<T>) => Promise<T>;

// ============================================
// infrastructure/access/prisma-record-ownership.ts — who owns a record, from the database (ADR 067)
// ============================================
// Design patterns:
//   - REGISTRY of STRATEGIES: each owned record type declares ONE lookup in
//     `OWNER_LOOKUPS`; making another type ownable is one entry (Open/Closed).
//   - Implements the domain's `RecordOwnership` interface (Dependency Inversion).
// Ownership is always read from trusted server-side rows — never from the
// request — so a client cannot claim ownership by sending `ownerId`.

import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { PermissionResource } from "@workspace/shared";

import type { SystemDatabaseContext } from "../../../../prisma/tenant-context";
import { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import { ACCESS_FACTS_OPERATION } from "../../../../platform/application/shared-system-operations";
import type { RecordOwnership } from "../../domain/access/allow-paths";

interface OwnershipTransactions {
	withSystemOperation<TResult>(context: SystemDatabaseContext, work: (tx: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult>;
}

/** Reads the owning user of one record (`null`: no such live record). */
type OwnerLookup = (tx: Prisma.TransactionClient, resourceId: string) => Promise<string | null>;

/** A user's own account (USER) and profile (PROFILE) belong to that user. */
const ownAccount: OwnerLookup = async (tx, resourceId) => (await tx.user.findFirst({ where: { id: resourceId, isDeleted: false }, select: { id: true } }))?.id ?? null;

/**
 * Every record type with an owner (a REGISTRY of lookup strategies: a new owned type is one entry).
 * The same owner column is what RLS checks for these tables (`app_owns("userId")` in `prisma/rls.sql`,
 * e.g. `reward_claims_own`), so the API and the database agree on who owns what.
 */
const OWNER_LOOKUPS: Readonly<Partial<Record<PermissionResource, OwnerLookup>>> = {
	USER: ownAccount,
	PROFILE: ownAccount,
	CLAIM: claimHolder,
};

/** A reward claim belongs to the customer who holds it. */
async function claimHolder(tx: Prisma.TransactionClient, resourceId: string): Promise<string | null> {
	return (await tx.rewardClaim.findFirst({ where: { id: resourceId, isDeleted: false }, select: { userId: true } }))?.userId ?? null;
}

@Injectable()
export class PrismaRecordOwnership implements RecordOwnership {
	public constructor(@Inject(TenantTransactionService) private readonly transactions: OwnershipTransactions) {}

	public async ownerOf(resource: PermissionResource, resourceId: string): Promise<string | null> {
		const lookup = OWNER_LOOKUPS[resource];
		if (lookup === undefined) {
			return null;
		}
		return this.transactions.withSystemOperation(
			{ operation: ACCESS_FACTS_OPERATION, reason: "Read who owns the record an access decision is about", actorUserId: null },
			(tx) => lookup(tx, resourceId),
		);
	}
}

import type { Prisma } from "@prisma/client";

import type { StoreClosurePort, StoreClosureRequest, StoreClosureResult } from "../../../../platform/application/ports/store-closure.port";
import type { StoreClosureFactory } from "../../../organizations/public-api";

/**
 * Organizations' `StoreClosurePort` (D27), on the store-closure transaction: the store's live tills are
 * soft-deleted (clearing their codes) and every live key of the store or of those tills is revoked,
 * so the closure commits or rolls back as one unit.
 */
export class PrismaStoreClosure implements StoreClosurePort {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async closeStore(request: StoreClosureRequest): Promise<StoreClosureResult> {
		const { organizationId, locationId, closedByUserId, closedAt } = request;
		const terminals = await this.db.organizationTerminal.findMany({ where: { organizationId, locationId, isDeleted: false }, select: { id: true, apiKeyId: true } });
		const terminalKeyIds: string[] = terminals.flatMap((terminal): string[] => (terminal.apiKeyId === null ? [] : [terminal.apiKeyId]));
		const removed = await this.db.organizationTerminal.updateMany({
			where: { id: { in: terminals.map((terminal): string => terminal.id) }, isDeleted: false },
			data: { isDeleted: true, deletedAt: closedAt, deletedBy: closedByUserId, pairingCodeHash: null, pairingCodeExpiresAt: null, updatedAt: closedAt },
		});
		const revoked = await this.db.organizationApiKey.updateMany({
			where: { organizationId, isDeleted: false, revokedAt: null, OR: [{ locationId }, { id: { in: terminalKeyIds } }] },
			data: { revokedAt: closedAt, updatedAt: closedAt },
		});
		return { terminalsRemoved: removed.count, apiKeysRevoked: revoked.count };
	}
}

/** Binds {@link PrismaStoreClosure} to the transaction organizations' unit of work hands it. */
export const PRISMA_STORE_CLOSURE_FACTORY: StoreClosureFactory = {
	forTransaction(db: Prisma.TransactionClient): StoreClosurePort {
		return new PrismaStoreClosure(db);
	},
};

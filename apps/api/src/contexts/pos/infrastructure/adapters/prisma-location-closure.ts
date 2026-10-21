import type { Prisma } from "@prisma/client";

import type { LocationClosurePort, LocationClosureRequest, LocationClosureResult } from "../../../../platform/application/ports/location-closure.port";
import type { LocationClosureFactory } from "../../../tenancy/public-api";

/**
 * Tenants' `LocationClosurePort` (D27), on the location-closure transaction: the store's live tills are
 * soft-deleted (clearing their codes) and every live key of the store or of those tills is revoked,
 * so the closure commits or rolls back as one unit.
 */
export class PrismaLocationClosure implements LocationClosurePort {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async closeLocation(request: LocationClosureRequest): Promise<LocationClosureResult> {
		const { tenantId, locationId, closedByUserId, closedAt } = request;
		const terminals = await this.db.tenantTerminal.findMany({ where: { tenantId, locationId, isDeleted: false }, select: { id: true, apiKeyId: true } });
		const terminalKeyIds: string[] = terminals.flatMap((terminal): string[] => (terminal.apiKeyId === null ? [] : [terminal.apiKeyId]));
		const removed = await this.db.tenantTerminal.updateMany({
			where: { id: { in: terminals.map((terminal): string => terminal.id) }, isDeleted: false },
			data: { isDeleted: true, deletedAt: closedAt, deletedBy: closedByUserId, pairingCodeHash: null, pairingCodeExpiresAt: null, updatedAt: closedAt },
		});
		const revoked = await this.db.tenantApiKey.updateMany({
			where: { tenantId, isDeleted: false, revokedAt: null, OR: [{ locationId }, { id: { in: terminalKeyIds } }] },
			data: { revokedAt: closedAt, updatedAt: closedAt },
		});
		return { terminalsRemoved: removed.count, apiKeysRevoked: revoked.count };
	}
}

/** Binds {@link PrismaLocationClosure} to the transaction tenants' unit of work hands it. */
export const PRISMA_LOCATION_CLOSURE_FACTORY: LocationClosureFactory = {
	forTransaction(db: Prisma.TransactionClient): LocationClosurePort {
		return new PrismaLocationClosure(db);
	},
};

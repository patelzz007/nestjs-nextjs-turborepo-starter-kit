import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { EpochMs } from "@workspace/shared";

import type { RegisteredTill, TillTerminalsPort } from "../../application/ports/till-terminals.port";
import type { SystemDatabaseContext } from "../../../../prisma/tenant-context";
import { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import { AUTH_API_KEY_LOOKUP_OPERATION } from "../../application/ports/pos.tokens";

/** The POS guard's till lookups, under `auth.api_key.lookup`. */
interface TillLookupTransactions {
	withSystemOperation<TResult>(context: SystemDatabaseContext, work: (tx: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult>;
}

/** The POS guard's till lookups, in the guards' pre-handler phase. */
@Injectable()
export class PrismaTillTerminals implements TillTerminalsPort {
	public constructor(@Inject(TenantTransactionService) private readonly transactions: TillLookupTransactions) {}

	public async findLive(tenantId: string, terminalId: string): Promise<RegisteredTill | null> {
		return this.transactions.withSystemOperation({ operation: AUTH_API_KEY_LOOKUP_OPERATION, reason: "Read a live till for an API-key request", actorUserId: null }, (tx) =>
			tx.tenantTerminal.findFirst({ where: { tenantId, terminalId, isDeleted: false }, select: { id: true, locationId: true } }),
		);
	}

	public async touchLastSeen(terminalRowId: string, at: EpochMs): Promise<void> {
		await this.transactions.withSystemOperation({ operation: AUTH_API_KEY_LOOKUP_OPERATION, reason: "Record when a till was last seen", actorUserId: null }, (tx) =>
			tx.tenantTerminal.update({ where: { id: terminalRowId }, data: { lastSeenAt: at }, select: { id: true } }),
		);
	}
}

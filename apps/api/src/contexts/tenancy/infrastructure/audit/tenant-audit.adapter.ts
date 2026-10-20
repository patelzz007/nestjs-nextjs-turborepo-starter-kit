import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import type { TenantAuditEntry, TenantAuditPort, TenantAuditWriter } from "../../application/ports/tenant-audit.port";

/** The transaction delegate a tenant audit row is written through (the caller's transaction). */
export type TenantAuditTransaction = Pick<Prisma.TransactionClient, "tenantAuditLog">;

/**
 * The only writer of `TenantAuditLog`. Every row is appended INSIDE
 * the caller's transaction, so it commits or rolls back together with the
 * state change it describes. (Kept under its established class name: other
 * contexts still construct it directly while they move to `TENANT_AUDIT`.)
 */
@Injectable()
export class TenantAuditService implements TenantAuditPort<TenantAuditTransaction> {
	public async recordInTx(tx: TenantAuditTransaction, entry: TenantAuditEntry): Promise<void> {
		await tx.tenantAuditLog.create({
			data: {
				tenantId: entry.tenantId,
				actorUserId: entry.actorUserId,
				action: entry.action,
				resourceType: entry.resourceType,
				resourceId: entry.resourceId,
				decision: entry.decision ?? null,
				policyVersion: entry.policyVersion,
				correlationId: entry.correlationId ?? null,
				...(entry.metadata === undefined ? {} : { metadata: { ...entry.metadata } }),
			},
		});
	}
}

/** {@link TenantAuditWriter} bound to one unit-of-work transaction. */
export class TransactionTenantAuditWriter implements TenantAuditWriter {
	public constructor(
		private readonly db: TenantAuditTransaction,
		private readonly audit: TenantAuditPort<TenantAuditTransaction>,
	) {}

	public async record(entry: TenantAuditEntry): Promise<void> {
		await this.audit.recordInTx(this.db, entry);
	}
}

/** The audit port for code that composes its own objects (CLIs, tests) instead of injecting `TENANT_AUDIT`. */
export function createTenantAuditPort(): TenantAuditPort<TenantAuditTransaction> {
	return new TenantAuditService();
}

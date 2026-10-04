import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { TenantTransactionService } from "../../prisma/tenant-transaction.service";
import { toAuditLogCreateInput } from "./audit-log.mapper";
import type { HttpAuditEntry } from "./http-audit-entry";

/** Allowlisted system operation the global audit rows are appended under (system-operation.registry.ts). */
export const AUDIT_RECORD_OPERATION = "audit.http_request.record";

/**
 * The slice of a transaction client an audit append needs — satisfied by every
 * transaction client in the API. The transaction must run under a named system
 * operation: `audit_logs` accepts INSERTs only with `app_rls_bypass()`.
 */
export type AuditLogWriter = Pick<Prisma.TransactionClient, "auditLog">;

/**
 * Append-only access to `audit_logs`. There is deliberately no update or
 * delete method — the database revokes both from `app_runtime` anyway.
 */
@Injectable()
export class AuditLogRepository {
	public constructor(private readonly tenantTx: TenantTransactionService) {}

	/** Append one row in its own transaction under `audit.http_request.record`. */
	public async append(entry: HttpAuditEntry): Promise<void> {
		await this.tenantTx.withSystemOperation(
			{ operation: AUDIT_RECORD_OPERATION, reason: `${entry.method} ${entry.endpoint} ${entry.outcome}`, actorUserId: entry.actorUserId },
			async (tx): Promise<void> => {
				await tx.auditLog.create({ data: toAuditLogCreateInput(entry) });
			},
		);
	}

	/** Append one row inside the CALLER's (system-operation) transaction — it commits or rolls back with the caller's writes. */
	public async appendInTransaction(tx: AuditLogWriter, entry: HttpAuditEntry): Promise<void> {
		await tx.auditLog.create({ data: toAuditLogCreateInput(entry) });
	}
}

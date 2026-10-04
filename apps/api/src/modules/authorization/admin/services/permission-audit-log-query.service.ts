import { Injectable } from "@nestjs/common";
import type { PermissionAuditLog, Prisma } from "@prisma/client";
import { assertNever, AuditLogEntrySchema, epochMs, type AuditLogActor, type AuditLogEntry, type AuditLogQueryInput, type PaginatedServiceResult } from "@workspace/shared";

import { mapListResult, toPaginatedServiceResult } from "../../../../platform/persistence/list-page";
import { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import { PermissionAuditLogRepository } from "../repositories/permission-audit-log.repository";

/** The stored actor (`actor_kind` + `actor_id`) as the contract's discriminated union. */
export function toAuditLogActor(row: Pick<PermissionAuditLog, "actorKind" | "actorId" | "impersonatorId">): AuditLogActor {
	switch (row.actorKind) {
		case "USER":
			return { kind: "USER", userId: row.actorId, impersonatorId: row.impersonatorId };
		case "SYSTEM_OPERATION":
			return { kind: "SYSTEM_OPERATION", operation: row.actorId };
		default:
			return assertNever(row.actorKind, "permission audit actor kind");
	}
}

/** Map a persistence row to the public `AuditLogEntry` contract (bigint epochs → numbers, internals dropped). */
export function toAuditLogEntry(row: PermissionAuditLog): AuditLogEntry {
	return AuditLogEntrySchema.parse({
		id: row.id,
		actor: toAuditLogActor(row),
		targetUserId: row.targetUserId,
		targetRoleId: row.targetRoleId,
		permissionId: row.permissionId,
		action: row.action,
		detail: row.detail,
		createdAt: epochMs(Number(row.createdAt)),
		updatedAt: epochMs(Number(row.updatedAt)),
	});
}

/**
 * Application service behind `GET /admin/audit`. `permission_audit_logs` is
 * bypass-only under RLS, so the read runs under the allowlisted
 * `authorization.audit_log.read` operation — after the controller's
 * `AUDIT_LOG:READ` check.
 */
@Injectable()
export class PermissionAuditLogQueryService {
	public constructor(
		private readonly repository: PermissionAuditLogRepository,
		private readonly tenantTx: TenantTransactionService,
	) {}

	public async list(actorId: string, query: AuditLogQueryInput): Promise<PaginatedServiceResult<AuditLogEntry>> {
		const result = await this.tenantTx.withSystemOperation(
			{ operation: "authorization.audit_log.read", reason: "Admin audit viewer list", actorUserId: actorId },
			async (tx: Prisma.TransactionClient) => this.repository.list(query, tx),
		);
		return toPaginatedServiceResult(mapListResult(result, toAuditLogEntry), query);
	}
}

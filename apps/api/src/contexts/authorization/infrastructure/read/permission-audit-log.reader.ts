import { Injectable } from "@nestjs/common";
import type { PermissionAuditLog, Prisma } from "@prisma/client";
import { assertNever, AuditLogEntrySchema, epochMs, type AuditLogActor, type AuditLogEntry, type AuditLogQueryInput, type PaginatedServiceResult } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { mapListResult, toPaginatedServiceResult } from "../../../../platform/infrastructure/persistence/list-page";
import { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import { AUDIT_LOG_READ_OPERATION } from "../../application/ports/authorization.tokens";
import type { PermissionAuditLogReadPort } from "../../application/ports/rbac-read.port";
import { PermissionAuditLogRepository } from "../persistence/prisma-permission-audit-log.read-repository";

/** The stored actor (`actorKind` + `actorId`) as the contract's discriminated union. */
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

/** A persistence row → the public `AuditLogEntry` contract (bigint epochs → numbers, internals dropped). */
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

/** `GET /admin/audit`: the bypass-only table is read under `authorization.audit_log.read`, after the `AUDIT_LOG:READ` check. */
@Injectable()
export class PermissionAuditLogReader implements PermissionAuditLogReadPort {
	private readonly repository: PermissionAuditLogRepository = new PermissionAuditLogRepository();

	public constructor(private readonly tenantTx: TenantTransactionService) {}

	public async list(actor: ActorContext, query: AuditLogQueryInput): Promise<PaginatedServiceResult<AuditLogEntry>> {
		const actorUserId: string | null = actor.kind === "user" ? actor.userId : null;
		const result = await this.tenantTx.withSystemOperation(
			{ operation: AUDIT_LOG_READ_OPERATION, reason: "Admin audit viewer list", actorUserId },
			async (tx: Prisma.TransactionClient) => this.repository.list(query, tx),
		);
		return toPaginatedServiceResult(mapListResult(result, toAuditLogEntry), query);
	}
}

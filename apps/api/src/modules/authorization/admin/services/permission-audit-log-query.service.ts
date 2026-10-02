import { Injectable } from "@nestjs/common";
import type { PermissionAuditLog } from "@prisma/client";
import { AuditLogEntrySchema, epochMs, type AuditLogEntry, type AuditLogQueryInput, type PaginatedServiceResult } from "@workspace/shared";

import { mapListResult, toPaginatedServiceResult } from "../../../../platform/persistence/list-page";
import { PermissionAuditLogRepository } from "../repositories/permission-audit-log.repository";

/** Map a persistence row to the public `AuditLogEntry` contract (bigint epochs → numbers, internals dropped). */
export function toAuditLogEntry(row: PermissionAuditLog): AuditLogEntry {
	return AuditLogEntrySchema.parse({
		id: row.id,
		actorId: row.actorId,
		targetUserId: row.targetUserId,
		targetRoleId: row.targetRoleId,
		permissionId: row.permissionId,
		action: row.action,
		detail: row.detail,
		createdAt: epochMs(Number(row.createdAt)),
		updatedAt: epochMs(Number(row.updatedAt)),
	});
}

/** Application service behind `GET /admin/audit`. */
@Injectable()
export class PermissionAuditLogQueryService {
	public constructor(private readonly repository: PermissionAuditLogRepository) {}

	public async list(query: AuditLogQueryInput): Promise<PaginatedServiceResult<AuditLogEntry>> {
		const result = await this.repository.list(query);
		return toPaginatedServiceResult(mapListResult(result, toAuditLogEntry), query);
	}
}

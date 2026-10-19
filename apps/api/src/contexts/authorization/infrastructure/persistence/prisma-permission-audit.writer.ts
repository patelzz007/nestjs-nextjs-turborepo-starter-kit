import type { Prisma } from "@prisma/client";
import type { EpochMs } from "@workspace/shared";

import type { RequestContextService } from "../../../../platform/infrastructure/context/request-context";
import type { PermissionAuditEntry, PermissionAuditWriter } from "../../application/ports/permission-audit.port";

/**
 * `PermissionAuditLog` (bypass-only) on the caller's transaction: the row commits or rolls back with
 * the change it describes. Stamps the request's correlation id and impersonator. Failures propagate.
 */
export class PrismaPermissionAuditWriter implements PermissionAuditWriter {
	public constructor(
		private readonly db: Prisma.TransactionClient,
		private readonly requestContext: RequestContextService,
	) {}

	public async append(entry: PermissionAuditEntry): Promise<void> {
		const context = this.requestContext.current();
		await this.db.permissionAuditLog.create({
			data: {
				actorKind: entry.actor.kind,
				actorId: entry.actor.kind === "USER" ? entry.actor.userId : entry.actor.operation,
				targetUserId: entry.targetUserId ?? null,
				targetRoleId: entry.targetRoleId ?? null,
				permissionId: entry.permissionId ?? null,
				action: entry.action,
				detail: entry.detail ?? null,
				correlationId: context?.correlationId ?? null,
				impersonatorId: context?.principal?.impersonatorId ?? null,
			},
		});
	}

	public async retireCreatedBefore(cutoff: EpochMs, now: EpochMs): Promise<number> {
		const { count } = await this.db.permissionAuditLog.updateMany({
			where: { isDeleted: false, createdAt: { lt: BigInt(cutoff) } },
			data: { isDeleted: true, deletedAt: now },
		});
		return count;
	}
}

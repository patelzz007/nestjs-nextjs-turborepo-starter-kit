import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import type { Prisma } from "@prisma/client";
import { nowEpochMs } from "@workspace/shared";

import type { SystemOperation } from "../../../prisma/system-operation.registry";
import { RoleAssignmentRepository, type ExpiredDirectOverride } from "../repositories/role-assignment.repository";
import { RbacMutationRunner, type RbacAuditDraft } from "../services/rbac-mutation.runner";

/** The allowlisted operation the job runs under — also the audited actor of every expiry. */
export const PERMISSION_EXPIRY_OPERATION: SystemOperation = "maintenance.permission_expiry";

/**
 * Hourly job that expires time-bound direct permission overrides (ALLOW and DENY).
 *
 * Runs through {@link RbacMutationRunner} like every other RBAC change: in one
 * transaction (under `maintenance.permission_expiry`, holding the RBAC lock)
 * it soft-deletes exactly the overrides it found expired, revokes the
 * affected users' sessions (refresh tokens + tokenVersion), and writes one
 * `PERMISSION_EXPIRED` audit row per override with the operation as the
 * explicit actor. Caches are invalidated on every instance only after commit.
 *
 * Expiry enforcement does not depend on this job — expired overrides are
 * already ignored at evaluation time — it makes the change durable, audited,
 * and session-revoking.
 */
@Injectable()
export class PermissionExpiryCleanup {
	private readonly logger: Logger = new Logger(PermissionExpiryCleanup.name);

	public constructor(
		private readonly assignments: RoleAssignmentRepository,
		private readonly runner: RbacMutationRunner,
	) {}

	@Cron(CronExpression.EVERY_HOUR)
	public async handleExpiryCleanup(): Promise<void> {
		const expiredCount: number = await this.runner.runAsSystemOperation(
			PERMISSION_EXPIRY_OPERATION,
			"Expire time-bound direct permission overrides",
			async (tx: Prisma.TransactionClient) => {
				const nowMs: number = nowEpochMs();
				const expired: ExpiredDirectOverride[] = await this.assignments.findExpiredOverrides(nowMs, tx);
				// The RBAC lock is held, so no RBAC write can revive or re-grant these rows before commit.
				const count: number = await this.assignments.expireOverrides(
					expired.map((override): string => override.id),
					nowMs,
					tx,
				);
				const audits: RbacAuditDraft[] = expired.map((override): RbacAuditDraft => ({
					action: "PERMISSION_EXPIRED",
					targetUserId: override.userId,
					permissionId: override.permissionId,
					detail: JSON.stringify({ effect: override.effect, expiredAt: nowMs }),
				}));
				return { result: count, audits, affectedUserIds: expired.map((override): string => override.userId) };
			},
		);

		if (expiredCount > 0) {
			this.logger.log(`Expired ${String(expiredCount)} direct permission override(s)`);
		}
	}
}

import { Injectable, Logger } from "@nestjs/common";

import { PrismaService } from "../../../prisma/prisma.service";

// ── Types ───────────────────────────────────────────────────────────────────

export interface AuditEntry {
	readonly action: string;
	readonly actorId: string;
	readonly targetUserId?: string;
	readonly targetRoleId?: string;
	readonly permissionId?: string;
	readonly detail?: string;
}

// ── Service ─────────────────────────────────────────────────────────────────

/**
 * Logs all authorization mutations to the `PermissionAuditLog` table.
 *
 * Writes are fire-and-forget — never block the caller.  Failures are
 * logged but never thrown.
 */
@Injectable()
export class AuthorizationAuditService {
	private readonly logger: Logger = new Logger(AuthorizationAuditService.name);

	public constructor(private readonly prisma: PrismaService) {}

	/**
	 * Record an authorization audit event.
	 *
	 * @param entry - The event to record.
	 */
	public async log(entry: AuditEntry): Promise<void> {
		try {
			await this.prisma.permissionAuditLog.create({
				data: {
					actorId: entry.actorId,
					targetUserId: entry.targetUserId ?? null,
					targetRoleId: entry.targetRoleId ?? null,
					permissionId: entry.permissionId ?? null,
					action: entry.action,
					detail: entry.detail ?? null,
				},
			});
		} catch (error) {
			this.logger.error(`Audit log write failed: ${error instanceof Error ? error.message : "unknown"}`);
		}
	}

	/** Log a role assignment. */
	public async logRoleAssignment(actorId: string, userId: string, roleId: string): Promise<void> {
		await this.log({ action: "ROLE_ASSIGNED", actorId, targetUserId: userId, targetRoleId: roleId });
	}

	/** Log a role removal. */
	public async logRoleRemoval(actorId: string, userId: string, roleId: string): Promise<void> {
		await this.log({ action: "ROLE_REMOVED", actorId, targetUserId: userId, targetRoleId: roleId });
	}

	/** Log a direct permission grant. */
	public async logPermissionGrant(actorId: string, userId: string, permissionId: string): Promise<void> {
		await this.log({ action: "PERMISSION_GRANTED", actorId, targetUserId: userId, permissionId });
	}

	/** Log a direct permission revocation. */
	public async logPermissionRevocation(actorId: string, userId: string, permissionId: string): Promise<void> {
		await this.log({ action: "PERMISSION_REVOKED", actorId, targetUserId: userId, permissionId });
	}

	/** Log a role creation. */
	public async logRoleCreation(actorId: string, roleId: string, roleName: string): Promise<void> {
		await this.log({ action: "ROLE_CREATED", actorId, targetRoleId: roleId, detail: roleName });
	}

	/** Log a role deletion. */
	public async logRoleDeletion(actorId: string, roleId: string, roleName: string): Promise<void> {
		await this.log({ action: "ROLE_DELETED", actorId, targetRoleId: roleId, detail: roleName });
	}

	/** Log a permission creation. */
	public async logPermissionCreation(actorId: string, permissionId: string, detail: string): Promise<void> {
		await this.log({ action: "PERMISSION_CREATED", actorId, permissionId, detail });
	}

	/** Log a permission deletion. */
	public async logPermissionDeletion(actorId: string, permissionId: string, detail: string): Promise<void> {
		await this.log({ action: "PERMISSION_DELETED", actorId, permissionId, detail });
	}
}

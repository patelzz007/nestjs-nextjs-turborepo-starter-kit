import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { RequestContextService } from "../../../common/context/request-context";
import type { SystemOperation } from "../../../prisma/system-operation.registry";

// ── Types ───────────────────────────────────────────────────────────────────

/** Every action written to `permission_audit_logs`. */
export type AuthorizationAuditAction =
	| "ROLE_CREATED"
	| "ROLE_UPDATED"
	| "ROLE_DELETED"
	| "ROLE_RESTORED"
	| "ROLE_PARENT_SET"
	| "ROLE_PERMISSIONS_SYNCED"
	| "ROLE_ASSIGNED"
	| "ROLE_ASSIGNED_AT_PROVISIONING"
	| "ROLE_REMOVED"
	| "USER_ROLES_SYNCED"
	| "PERMISSION_CREATED"
	| "PERMISSION_UPDATED"
	| "PERMISSION_DELETED"
	| "PERMISSION_RESTORED"
	| "PERMISSION_GRANTED"
	| "PERMISSION_REVOKED"
	| "PERMISSION_EXPIRED"
	| "USER_PERMISSIONS_SYNCED"
	| "SUPER_ADMIN_BYPASS"
	| "SUPER_ADMIN_BOOTSTRAPPED"
	| "REFERENCE_DATA_SYNCED";

/**
 * Who performed the change. A user is identified by their `users.id`; a
 * scheduled job by the allowlisted system operation it ran under — never by a
 * placeholder such as `"system"`, which would not say which code path acted.
 */
export type AuditActor = { readonly kind: "USER"; readonly userId: string } | { readonly kind: "SYSTEM_OPERATION"; readonly operation: SystemOperation };

export interface AuditEntry {
	readonly action: AuthorizationAuditAction;
	readonly actor: AuditActor;
	readonly targetUserId?: string;
	readonly targetRoleId?: string;
	readonly permissionId?: string;
	/** The applied change (JSON) — never secrets. */
	readonly detail?: string;
}

// ── Service ─────────────────────────────────────────────────────────────────

/**
 * Appends authorization changes to `permission_audit_logs` (bypass-only table).
 *
 * The write runs on the caller's transaction client so the audit row commits
 * or rolls back together with the change it describes. Failures propagate:
 * an RBAC change that cannot be audited does not happen.
 */
@Injectable()
export class AuthorizationAuditService {
	public constructor(private readonly requestContext: RequestContextService) {}

	/**
	 * Record an authorization audit event on `db` (the mutation's transaction,
	 * or a bypass-scoped client for standalone events such as the SuperAdmin
	 * bypass). Stamps the request's correlation id and impersonator.
	 */
	public async record(entry: AuditEntry, db: Prisma.TransactionClient): Promise<void> {
		const context = this.requestContext.current();
		await db.permissionAuditLog.create({
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
}

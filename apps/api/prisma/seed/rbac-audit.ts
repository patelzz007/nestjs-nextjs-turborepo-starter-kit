import type { PermissionAuditActorKind, Prisma } from "@prisma/client";

import { deterministicUuid } from "./deterministic-uuid";
import { prisma } from "./client";

/** Namespace for deterministic RBAC audit-row ids and correlation ids (stable across re-seeds). */
const RBAC_AUDIT_NAMESPACE = "seed.permission_audit_logs";

/** The two assignment actions the app records (`AuthorizationAuditService`). */
export type SeedRoleAssignmentAction = "ROLE_ASSIGNED" | "ROLE_ASSIGNED_AT_PROVISIONING";

export interface SeedRoleAssignment {
	readonly userId: string;
	readonly roleId: string;
	/** Who made the assignment: the platform operator for staff roles, the account itself for self-provisioned roles. */
	readonly actorId: string;
	readonly action: SeedRoleAssignmentAction;
	/** Seed scenario name — part of the deterministic correlation id. */
	readonly scenario: string;
}

/** One `permission_audit_logs` row as the app writes it (`AuthorizationAuditService.record`). */
export interface SeedAuditEntry {
	/** Stable key → deterministic row id and correlation id (re-seeds converge). */
	readonly key: string;
	readonly action: string;
	readonly actorKind: PermissionAuditActorKind;
	/** `users.id` for USER, the allowlisted operation name for SYSTEM_OPERATION. */
	readonly actorId: string;
	readonly targetUserId?: string | undefined;
	readonly targetRoleId?: string | undefined;
	readonly permissionId?: string | undefined;
	readonly detail?: string | undefined;
	/** The SuperAdmin behind an impersonation session, when the actor was impersonated. */
	readonly impersonatorId?: string | undefined;
	/** Epoch ms the change was recorded at (default: now). */
	readonly createdAt?: number | undefined;
	/** Epoch ms the 90-day retention job soft-deleted this row (`AuditLogCleanup`); omit for a live row. */
	readonly retiredAt?: number | undefined;
}

/** Append (idempotently) the audit row for a seeded RBAC change, on the change's own transaction. */
export async function recordSeedAudit(tx: Prisma.TransactionClient, entry: SeedAuditEntry): Promise<void> {
	const id: string = deterministicUuid(RBAC_AUDIT_NAMESPACE, entry.key);
	await tx.permissionAuditLog.upsert({
		where: { id },
		create: {
			id,
			actorKind: entry.actorKind,
			actorId: entry.actorId,
			targetUserId: entry.targetUserId ?? null,
			targetRoleId: entry.targetRoleId ?? null,
			permissionId: entry.permissionId ?? null,
			action: entry.action,
			detail: entry.detail ?? null,
			correlationId: `seed-${deterministicUuid(`${RBAC_AUDIT_NAMESPACE}.correlation`, entry.key)}`,
			impersonatorId: entry.impersonatorId ?? null,
			...(entry.createdAt === undefined ? {} : { createdAt: entry.createdAt, updatedAt: entry.retiredAt ?? entry.createdAt }),
			...(entry.retiredAt === undefined ? {} : { isDeleted: true, deletedAt: entry.retiredAt }),
		},
		update: {},
	});
}

/**
 * Assign a role the way the app does: the live `user_roles` row carries
 * `assignedBy`, and the same transaction appends the `permission_audit_logs`
 * row (real actor, correlation id) — idempotent across re-seeds.
 */
export async function assignSeedRole(assignment: SeedRoleAssignment): Promise<void> {
	await prisma.$transaction(async (tx: Prisma.TransactionClient): Promise<void> => {
		await tx.userRole.upsert({
			where: { userId_roleId: { userId: assignment.userId, roleId: assignment.roleId } },
			create: { userId: assignment.userId, roleId: assignment.roleId, assignedBy: assignment.actorId },
			update: { isDeleted: false, deletedAt: null, assignedBy: assignment.actorId },
		});
		await recordSeedAudit(tx, {
			key: `${assignment.scenario}:${assignment.userId}:${assignment.roleId}`,
			action: assignment.action,
			actorKind: "USER",
			actorId: assignment.actorId,
			targetUserId: assignment.userId,
			targetRoleId: assignment.roleId,
		});
	});
}

import type { Permission, PermissionAction, PermissionResource, Prisma, Role, User } from "@prisma/client";

import { deterministicUuid } from "./deterministic-uuid";
import { prisma } from "./client";
import { recordSeedAudit } from "./rbac-audit";
import { requireRow } from "./require-row";

// ---------------------------------------------------------------------------
// RBAC administration history (development scenario).
//
// Every RBAC column and state the admin API can produce, written the way the
// app writes it — each change in one transaction with its
// `permission_audit_logs` row (explicit actor kind, correlation id):
//
//   - `role_permissions.assignedBy` / `user_roles.assignedBy` on every row
//     (platform operator for the seeded matrix and staff roles, the account
//     itself for self-provisioned consumer roles);
//   - a real role hierarchy: "Support Agent" extends "Support Viewer"
//     (same trust plane — the child only ADDS capabilities);
//   - soft-deleted rows: a deleted role, a deleted admin-created permission, a
//     removed role assignment, an expired direct grant;
//   - direct overrides with `assignedBy`, a live temporary grant (`expiresAt`
//     in the future), a DENY override, and an expired grant expired by the
//     `maintenance.permission_expiry` job (actor_kind = SYSTEM_OPERATION);
//   - an impersonated change (impersonator_id set);
//   - a retired role permission (a capability taken off a role by a later sync) and an old audit
//     row the 90-day retention job has already soft-deleted.
// ---------------------------------------------------------------------------

const NAMESPACE = "seed.rbac-demo";
const DAY_MS = 24 * 60 * 60 * 1000;
/** A live temporary grant lasts 30 days from the seed run. */
const TEMPORARY_GRANT_TTL_MS = 30 * DAY_MS;
/** The expired grant lapsed two days before the seed run; the hourly job expired it. */
const EXPIRED_GRANT_AGE_MS = 2 * DAY_MS;
/** Allowlisted operation of the hourly expiry job — the audited actor of every expiry. */
const PERMISSION_EXPIRY_OPERATION = "maintenance.permission_expiry";

const SUPPORT_VIEWER_ROLE_ID = deterministicUuid(NAMESPACE, "role:support-viewer");
const SUPPORT_AGENT_ROLE_ID = deterministicUuid(NAMESPACE, "role:support-agent");
const LEGACY_ROLE_ID = deterministicUuid(NAMESPACE, "role:legacy-report-viewer");
const DELETED_PERMISSION_ID = deterministicUuid(NAMESPACE, "permission:delete-report");
/** The fixed demo clock of the retention history: 2026-05-01T09:00:00Z. */
const RETENTION_DEMO_BASE_EPOCH_MS = 1_777_626_000_000;
/** Retention of `permission_audit_logs` (`AuditLogCleanup`): older rows are soft-deleted. */
const AUDIT_RETENTION_MS = 90 * DAY_MS;
/** The hourly job soft-deletes a row within this long of it crossing the retention cutoff. */
const RETENTION_JOB_LAG_MS = 30 * 60 * 1000;

export interface RbacDemoSummary {
	readonly roles: number;
	readonly auditRows: number;
}

interface Lookup {
	readonly user: (email: string) => User;
	readonly role: (name: string) => Role;
	readonly permission: (action: PermissionAction, resource: PermissionResource) => Permission;
}

function lookup(users: readonly User[], roles: readonly Role[], permissions: readonly Permission[]): Lookup {
	return {
		user: (email: string): User =>
			requireRow(
				users.find((candidate) => candidate.email === email),
				`user ${email}`,
			),
		role: (name: string): Role =>
			requireRow(
				roles.find((candidate) => candidate.name === name),
				`role ${name}`,
			),
		permission: (action: PermissionAction, resource: PermissionResource): Permission =>
			requireRow(
				permissions.find((candidate) => candidate.action === action && candidate.resource === resource && candidate.scope === "GLOBAL"),
				`permission ${action}:${resource} (GLOBAL)`,
			),
	};
}

/** The seeded role matrix was configured by the platform operator. */
async function stampRoleMatrixOperator(roles: readonly Role[], operatorId: string): Promise<void> {
	await prisma.rolePermission.updateMany({
		where: { roleId: { in: roles.filter((role) => role.isSystem).map((role) => role.id) }, assignedBy: null },
		data: { assignedBy: operatorId },
	});
}

/** Self-provisioned consumer roles (signup / onboarding) are assigned by the account itself, with their audit row. */
async function attributeSelfProvisionedRoles(consumerRole: Role): Promise<number> {
	const unattributed = await prisma.userRole.findMany({ where: { roleId: consumerRole.id, assignedBy: null }, select: { userId: true } });
	for (const row of unattributed) {
		await prisma.$transaction(async (tx: Prisma.TransactionClient): Promise<void> => {
			await tx.userRole.update({ where: { userId_roleId: { userId: row.userId, roleId: consumerRole.id } }, data: { assignedBy: row.userId } });
			await recordSeedAudit(tx, {
				key: `provisioning:${row.userId}:${consumerRole.id}`,
				action: "ROLE_ASSIGNED_AT_PROVISIONING",
				actorKind: "USER",
				actorId: row.userId,
				targetUserId: row.userId,
				targetRoleId: consumerRole.id,
			});
		});
	}
	return unattributed.length;
}

/** "Support Agent" inherits "Support Viewer" (child adds UPDATE:USER); assigned to a staff member. */
async function seedSupportHierarchy(find: Lookup, operator: User): Promise<void> {
	const viewerPermissions = [find.permission("READ", "USER"), find.permission("LIST", "USER"), find.permission("READ", "PROFILE")];
	const agentPermissions = [find.permission("UPDATE", "USER")];
	const agentHolder = find.user("david.lee@example.com");

	await prisma.$transaction(async (tx: Prisma.TransactionClient): Promise<void> => {
		await tx.role.upsert({
			where: { id: SUPPORT_VIEWER_ROLE_ID },
			create: { id: SUPPORT_VIEWER_ROLE_ID, name: "Support Viewer", description: "Support desk — look up customer accounts (read-only)", isSystem: false },
			update: { isDeleted: false, deletedAt: null },
		});
		await tx.role.upsert({
			where: { id: SUPPORT_AGENT_ROLE_ID },
			create: {
				id: SUPPORT_AGENT_ROLE_ID,
				name: "Support Agent",
				description: "Support desk — Support Viewer plus correcting customer account details",
				isSystem: false,
				parentId: SUPPORT_VIEWER_ROLE_ID,
			},
			update: { isDeleted: false, deletedAt: null, parentId: SUPPORT_VIEWER_ROLE_ID },
		});
		for (const [roleId, granted] of [
			[SUPPORT_VIEWER_ROLE_ID, viewerPermissions],
			[SUPPORT_AGENT_ROLE_ID, agentPermissions],
		] satisfies readonly (readonly [string, readonly Permission[]])[]) {
			for (const permission of granted) {
				await tx.rolePermission.upsert({
					where: { roleId_permissionId: { roleId, permissionId: permission.id } },
					create: { roleId, permissionId: permission.id, assignedBy: operator.id },
					update: { isDeleted: false, deletedAt: null, assignedBy: operator.id },
				});
			}
			await recordSeedAudit(tx, { key: `role-created:${roleId}`, action: "ROLE_CREATED", actorKind: "USER", actorId: operator.id, targetRoleId: roleId });
			await recordSeedAudit(tx, {
				key: `role-permissions:${roleId}`,
				action: "ROLE_PERMISSIONS_SYNCED",
				actorKind: "USER",
				actorId: operator.id,
				targetRoleId: roleId,
				detail: JSON.stringify({ permissionIds: granted.map((permission) => permission.id) }),
			});
		}
		await recordSeedAudit(tx, {
			key: `role-parent:${SUPPORT_AGENT_ROLE_ID}`,
			action: "ROLE_PARENT_SET",
			actorKind: "USER",
			actorId: operator.id,
			targetRoleId: SUPPORT_AGENT_ROLE_ID,
			detail: JSON.stringify({ parentId: SUPPORT_VIEWER_ROLE_ID }),
		});
		await tx.userRole.upsert({
			where: { userId_roleId: { userId: agentHolder.id, roleId: SUPPORT_AGENT_ROLE_ID } },
			create: { userId: agentHolder.id, roleId: SUPPORT_AGENT_ROLE_ID, assignedBy: operator.id },
			update: { isDeleted: false, deletedAt: null, assignedBy: operator.id },
		});
		await recordSeedAudit(tx, {
			key: `role-assigned:${agentHolder.id}:${SUPPORT_AGENT_ROLE_ID}`,
			action: "ROLE_ASSIGNED",
			actorKind: "USER",
			actorId: operator.id,
			targetUserId: agentHolder.id,
			targetRoleId: SUPPORT_AGENT_ROLE_ID,
		});
	});
}

/**
 * A capability taken off a role by a later `syncRolePermissions` (the row is soft-deleted, never
 * removed) and the early audit row of the original grant, which the 90-day retention job has since
 * soft-deleted — what both columns look like in a database that has run for more than a quarter.
 */
async function seedRetentionHistory(find: Lookup, operator: User): Promise<void> {
	const retiredFromViewer = find.permission("READ", "ANALYTICS");
	const grantedAt = RETENTION_DEMO_BASE_EPOCH_MS;
	const removedAt = RETENTION_DEMO_BASE_EPOCH_MS + 14 * DAY_MS;
	await prisma.$transaction(async (tx: Prisma.TransactionClient): Promise<void> => {
		await tx.rolePermission.upsert({
			where: { roleId_permissionId: { roleId: SUPPORT_VIEWER_ROLE_ID, permissionId: retiredFromViewer.id } },
			create: {
				roleId: SUPPORT_VIEWER_ROLE_ID,
				permissionId: retiredFromViewer.id,
				assignedBy: operator.id,
				assignedAt: grantedAt,
				updatedAt: removedAt,
				isDeleted: true,
				deletedAt: removedAt,
			},
			update: {},
		});
		await recordSeedAudit(tx, {
			key: `role-permission-granted:${SUPPORT_VIEWER_ROLE_ID}:${retiredFromViewer.id}`,
			action: "ROLE_PERMISSIONS_SYNCED",
			actorKind: "USER",
			actorId: operator.id,
			targetRoleId: SUPPORT_VIEWER_ROLE_ID,
			permissionId: retiredFromViewer.id,
			detail: JSON.stringify({ added: [retiredFromViewer.id] }),
			createdAt: grantedAt,
			retiredAt: grantedAt + AUDIT_RETENTION_MS + RETENTION_JOB_LAG_MS,
		});
		await recordSeedAudit(tx, {
			key: `role-permission-removed:${SUPPORT_VIEWER_ROLE_ID}:${retiredFromViewer.id}`,
			action: "ROLE_PERMISSIONS_SYNCED",
			actorKind: "USER",
			actorId: operator.id,
			targetRoleId: SUPPORT_VIEWER_ROLE_ID,
			permissionId: retiredFromViewer.id,
			detail: JSON.stringify({ removed: [retiredFromViewer.id] }),
		});
	});
}

/** A retired role and a retired admin-created permission, both soft-deleted with their audit rows. */
async function seedRetiredCatalogRows(find: Lookup, operator: User, nowMs: number): Promise<void> {
	const readReport = find.permission("READ", "REPORT");
	await prisma.$transaction(async (tx: Prisma.TransactionClient): Promise<void> => {
		await tx.role.upsert({
			where: { id: LEGACY_ROLE_ID },
			create: {
				id: LEGACY_ROLE_ID,
				name: "Legacy Report Viewer",
				description: "Retired: replaced by the Admin role's report access",
				isSystem: false,
				isActive: false,
				isDeleted: true,
				deletedAt: nowMs,
			},
			update: {},
		});
		await tx.rolePermission.upsert({
			where: { roleId_permissionId: { roleId: LEGACY_ROLE_ID, permissionId: readReport.id } },
			create: { roleId: LEGACY_ROLE_ID, permissionId: readReport.id, assignedBy: operator.id },
			update: {},
		});
		await recordSeedAudit(tx, {
			key: `role-deleted:${LEGACY_ROLE_ID}`,
			action: "ROLE_DELETED",
			actorKind: "USER",
			actorId: operator.id,
			targetRoleId: LEGACY_ROLE_ID,
			detail: "Legacy Report Viewer",
		});

		// Admin-created (non-system) permission, later retired: DELETE:REPORT is not in the code registry.
		await tx.permission.upsert({
			where: { id: DELETED_PERMISSION_ID },
			create: {
				id: DELETED_PERMISSION_ID,
				action: "DELETE",
				resource: "REPORT",
				scope: "GLOBAL",
				description: "Delete generated reports (retired — reports are now immutable)",
				group: "Reports",
				isSystem: false,
				isDeleted: true,
				deletedAt: nowMs,
			},
			update: {},
		});
		await recordSeedAudit(tx, {
			key: `permission-deleted:${DELETED_PERMISSION_ID}`,
			action: "PERMISSION_DELETED",
			actorKind: "USER",
			actorId: operator.id,
			permissionId: DELETED_PERMISSION_ID,
			detail: "DELETE:REPORT",
		});
	});
}

/** Direct overrides: attributed grants, a live temporary grant, a DENY, and an expired grant expired by the job. */
async function seedDirectOverrides(find: Lookup, operator: User, nowMs: number): Promise<void> {
	const admin = find.user("admin@example.com");
	const seeded: readonly {
		readonly user: User;
		readonly permission: Permission;
		readonly effect: "ALLOW" | "DENY";
		readonly assignedBy: User;
		readonly expiresAt: number | null;
	}[] = [
		{ user: admin, permission: find.permission("DELETE", "USER"), effect: "ALLOW", assignedBy: operator, expiresAt: null },
		{ user: find.user("frank.miller@example.com"), permission: find.permission("MANAGE", "SYSTEM_SETTINGS"), effect: "ALLOW", assignedBy: operator, expiresAt: null },
		// Temporary analytics access for a quarterly review. Granted to an account no e2e suite uses as a
		// plain consumer, so the consumer personas (alice, bob, …) keep exactly their role's permissions.
		{
			user: find.user("isla.taylor@example.com"),
			permission: find.permission("READ", "ANALYTICS"),
			effect: "ALLOW",
			assignedBy: admin,
			expiresAt: nowMs + TEMPORARY_GRANT_TTL_MS,
		},
		// The Manager role grants LIST:REPORT; this manager is restricted from it.
		{ user: find.user("david.lee@example.com"), permission: find.permission("LIST", "REPORT"), effect: "DENY", assignedBy: admin, expiresAt: null },
	];
	for (const grant of seeded) {
		await prisma.$transaction(async (tx: Prisma.TransactionClient): Promise<void> => {
			await tx.userPermission.upsert({
				where: { userId_permissionId: { userId: grant.user.id, permissionId: grant.permission.id } },
				create: { userId: grant.user.id, permissionId: grant.permission.id, effect: grant.effect, assignedBy: grant.assignedBy.id, expiresAt: grant.expiresAt },
				update: { isDeleted: false, deletedAt: null, effect: grant.effect, assignedBy: grant.assignedBy.id, expiresAt: grant.expiresAt },
			});
			await recordSeedAudit(tx, {
				key: `permission-granted:${grant.user.id}:${grant.permission.id}`,
				action: "PERMISSION_GRANTED",
				actorKind: "USER",
				actorId: grant.assignedBy.id,
				targetUserId: grant.user.id,
				permissionId: grant.permission.id,
				detail: JSON.stringify({ effect: grant.effect, expiresAt: grant.expiresAt }),
			});
		});
	}

	// A temporary grant that lapsed; the hourly job soft-deleted it as `maintenance.permission_expiry`.
	const carol = find.user("carol.white@example.com");
	const readReport = find.permission("READ", "REPORT");
	const expiredAt = nowMs - EXPIRED_GRANT_AGE_MS;
	await prisma.$transaction(async (tx: Prisma.TransactionClient): Promise<void> => {
		await tx.userPermission.upsert({
			where: { userId_permissionId: { userId: carol.id, permissionId: readReport.id } },
			create: { userId: carol.id, permissionId: readReport.id, effect: "ALLOW", assignedBy: admin.id, expiresAt: expiredAt, isDeleted: true, deletedAt: expiredAt },
			update: {},
		});
		await recordSeedAudit(tx, {
			key: `permission-expired:${carol.id}:${readReport.id}`,
			action: "PERMISSION_EXPIRED",
			actorKind: "SYSTEM_OPERATION",
			actorId: PERMISSION_EXPIRY_OPERATION,
			targetUserId: carol.id,
			permissionId: readReport.id,
			detail: JSON.stringify({ effect: "ALLOW", expiredAt }),
		});
	});
}

/** A removed staff role (soft-deleted assignment) and an impersonated re-attachment of a consumer role. */
async function seedAssignmentHistory(find: Lookup, operator: User, nowMs: number): Promise<void> {
	const eve = find.user("eve.davis@example.com");
	const manager = find.role("Manager");
	await prisma.$transaction(async (tx: Prisma.TransactionClient): Promise<void> => {
		await tx.userRole.upsert({
			where: { userId_roleId: { userId: eve.id, roleId: manager.id } },
			create: { userId: eve.id, roleId: manager.id, assignedBy: operator.id, isDeleted: true, deletedAt: nowMs },
			update: {},
		});
		await recordSeedAudit(tx, {
			key: `role-removed:${eve.id}:${manager.id}`,
			action: "ROLE_REMOVED",
			actorKind: "USER",
			actorId: operator.id,
			targetUserId: eve.id,
			targetRoleId: manager.id,
		});
	});

	// During the seeded SuperAdmin impersonation of user@, the onboarding flow re-attached the consumer role.
	const impersonated = find.user("user@example.com");
	const consumerRole = find.role("User");
	await prisma.$transaction(async (tx: Prisma.TransactionClient): Promise<void> => {
		await recordSeedAudit(tx, {
			key: `impersonated-provisioning:${impersonated.id}:${consumerRole.id}`,
			action: "ROLE_ASSIGNED_AT_PROVISIONING",
			actorKind: "USER",
			actorId: impersonated.id,
			targetUserId: impersonated.id,
			targetRoleId: consumerRole.id,
			detail: "re-attached during merchant onboarding (impersonated support session)",
			impersonatorId: operator.id,
		});
	});
}

export async function seedRbacDemo(users: readonly User[], roles: readonly Role[], permissions: readonly Permission[]): Promise<RbacDemoSummary> {
	const find = lookup(users, roles, permissions);
	const operator = find.user("superadmin@example.com");
	const nowMs = Date.now();

	await stampRoleMatrixOperator(roles, operator.id);
	await attributeSelfProvisionedRoles(find.role("User"));
	await seedSupportHierarchy(find, operator);
	await seedRetiredCatalogRows(find, operator, nowMs);
	await seedRetentionHistory(find, operator);
	await seedDirectOverrides(find, operator, nowMs);
	await seedAssignmentHistory(find, operator, nowMs);

	return {
		roles: await prisma.role.count(),
		auditRows: await prisma.permissionAuditLog.count(),
	};
}

import { Injectable, Logger } from "@nestjs/common";
import type { Prisma, Role, UserRole } from "@prisma/client";
import type { PaginatedServiceResult } from "@workspace/shared";

import { AuthorizationError, ConflictError, NotFoundError } from "../../../common/errors/app-error";
import { toPaginatedServiceResult } from "../../../platform/persistence/list-page";
import { AuthorizationAuditService } from "../audit/authorization-audit.service";
import { DEFAULT_CONSUMER_ROLE_NAME, LAST_HOLDER_PROTECTED_ROLE_NAMES, MAX_ROLES_PER_USER } from "../constants/authorization.constants";
import { PermissionRepository } from "../repositories/permission.repository";
import { RoleAssignmentRepository } from "../repositories/role-assignment.repository";
import { RoleRepository, type CreateRoleInput, type UpdateRoleInput } from "../repositories/role.repository";
import { ConflictDetectionService } from "./conflict-detection.service";
import { PrivilegeEscalationService, type AuthorizationActor } from "./privilege-escalation.service";
import { RbacMutationRunner } from "./rbac-mutation.runner";

export type { CreateRoleInput, UpdateRoleInput };

/** Default page size for the internal role catalog read. */
const DEFAULT_ROLE_PAGE_LIMIT = 50;

/** Self-provisioned accounts act on their own behalf when the default role is attached. */
function selfActor(userId: string): AuthorizationActor {
	return { id: userId, isSuperAdmin: false };
}

/**
 * Role catalog, hierarchy, role → permission and user → role management.
 *
 * Every mutation:
 * - requires the authenticated actor (there is no actor-less overload);
 * - runs inside {@link RbacMutationRunner} — one transaction holding the RBAC
 *   lock, containing the privilege-escalation checks, the write, the session
 *   revocation of every affected user, the post-write invariants (separation
 *   of duties, last protected holder) and the audit row;
 * - invalidates caches on every instance only after commit.
 *
 * System roles (`isSystem`) are server-controlled: their name, state,
 * hierarchy and permission set cannot change, and they cannot be deleted,
 * through this service.
 */
@Injectable()
export class RoleService {
	private readonly logger: Logger = new Logger(RoleService.name);

	public constructor(
		private readonly roles: RoleRepository,
		private readonly assignments: RoleAssignmentRepository,
		private readonly permissions: PermissionRepository,
		private readonly escalation: PrivilegeEscalationService,
		private readonly conflicts: ConflictDetectionService,
		private readonly runner: RbacMutationRunner,
		private readonly audit: AuthorizationAuditService,
	) {}

	// ── Reads ────────────────────────────────────────────────────────────

	public async findById(roleId: string): Promise<Role | null> {
		return this.roles.findById(roleId);
	}

	public async findByName(name: string): Promise<Role | null> {
		return this.roles.findByName(name);
	}

	public async findByNames(names: readonly string[]): Promise<Role[]> {
		return this.roles.findByNames(names);
	}

	public async findAll(options: { readonly page?: number; readonly cursor?: string; readonly limit?: number } = {}): Promise<PaginatedServiceResult<Role>> {
		const query = { page: options.page ?? 1, limit: options.limit ?? DEFAULT_ROLE_PAGE_LIMIT, cursor: options.cursor };
		return toPaginatedServiceResult(await this.roles.list(query), query);
	}

	// ── Catalog ──────────────────────────────────────────────────────────

	/** Create a (non-system) role. A parent's permissions must be within the actor's reach. */
	public async create(actor: AuthorizationActor, input: CreateRoleInput): Promise<Role> {
		const role: Role = await this.runner.run(actor, "Create role", async (tx: Prisma.TransactionClient) => {
			if ((await this.roles.findByNameIncludingDeleted(input.name, tx)) !== null) {
				throw new ConflictError({ message: `Role "${input.name}" already exists (restore it if it was deleted)` });
			}
			if (input.parentId !== undefined) {
				await this.requireRole(input.parentId, tx);
				await this.escalation.assertCanGrantRoles(actor, [input.parentId], tx);
			}
			const created: Role = await this.roles.create(input, tx);
			return { kind: "changed", result: created, audit: { action: "ROLE_CREATED", targetRoleId: created.id, detail: JSON.stringify(input) }, affectedUserIds: [] };
		});
		this.logger.log(`Created role "${role.name}" (${role.id})`);
		return role;
	}

	/** Update a non-system role's metadata. Holders of the role (and of roles inheriting it) are re-authenticated. */
	public async update(actor: AuthorizationActor, roleId: string, input: UpdateRoleInput): Promise<Role> {
		return this.runner.run(actor, "Update role", async (tx: Prisma.TransactionClient) => {
			const role: Role = await this.requireMutableRole(actor, roleId, tx);
			if (input.name !== undefined && input.name !== role.name && (await this.roles.findByNameIncludingDeleted(input.name, tx)) !== null) {
				throw new ConflictError({ message: `Role "${input.name}" already exists` });
			}
			const affectedUserIds: string[] = await this.holdersOfLineage(roleId, tx);
			const updated: Role = await this.roles.update(roleId, input, tx);
			await this.conflicts.assertUsersHaveNoConflicts(affectedUserIds, tx);
			return { kind: "changed", result: updated, audit: { action: "ROLE_UPDATED", targetRoleId: roleId, detail: JSON.stringify(input) }, affectedUserIds };
		});
	}

	/** Soft-delete a non-system role. */
	public async remove(actor: AuthorizationActor, roleId: string): Promise<void> {
		const name: string = await this.runner.run(actor, "Delete role", async (tx: Prisma.TransactionClient) => {
			const role: Role = await this.requireMutableRole(actor, roleId, tx);
			const affectedUserIds: string[] = await this.holdersOfLineage(roleId, tx);
			await this.roles.softDelete(roleId, tx);
			return { kind: "changed", result: role.name, audit: { action: "ROLE_DELETED", targetRoleId: roleId, detail: role.name }, affectedUserIds };
		});
		this.logger.log(`Soft-deleted role "${name}" (${roleId})`);
	}

	/**
	 * Restore a soft-deleted role. Its holders regain its permissions and those
	 * of every ancestor, so every ancestor — deleted ones included — must be
	 * within the actor's reach.
	 */
	public async restore(actor: AuthorizationActor, roleId: string): Promise<Role> {
		return this.runner.run(actor, "Restore role", async (tx: Prisma.TransactionClient) => {
			const role: Role | null = await this.roles.findByIdIncludingDeleted(roleId, tx);
			if (!role?.isDeleted) {
				throw new NotFoundError({ message: `Deleted role ${roleId} not found` });
			}
			await this.escalation.assertNotHoldingRole(actor, roleId, tx);
			await this.escalation.assertCanGrantRoles(actor, [roleId], tx);
			const restored: Role = await this.roles.restore(roleId, tx);
			const affectedUserIds: string[] = await this.holdersOfLineage(roleId, tx);
			await this.conflicts.assertUsersHaveNoConflicts(affectedUserIds, tx);
			return { kind: "changed", result: restored, audit: { action: "ROLE_RESTORED", targetRoleId: roleId, detail: restored.name }, affectedUserIds };
		});
	}

	/** Set (or clear) the parent of a non-system role. Both the old and the new lineage must be within the actor's reach. */
	public async setParent(actor: AuthorizationActor, roleId: string, parentId: string | null): Promise<Role> {
		return this.runner.run(actor, "Set role parent", async (tx: Prisma.TransactionClient) => {
			const role: Role = await this.requireMutableRole(actor, roleId, tx);
			if (parentId !== null) {
				const parent: Role = await this.requireRole(parentId, tx);
				await this.escalation.assertCanGrantRoles(actor, [parentId], tx);
				if (await this.wouldCreateCycle(roleId, parentId, tx)) {
					throw new ConflictError({ message: `Setting "${parent.name}" as parent of "${role.name}" would create a circular hierarchy` });
				}
			}
			const affectedUserIds: string[] = await this.holdersOfLineage(roleId, tx);
			const updated: Role = await this.roles.setParent(roleId, parentId, tx);
			await this.conflicts.assertUsersHaveNoConflicts(affectedUserIds, tx);
			return { kind: "changed", result: updated, audit: { action: "ROLE_PARENT_SET", targetRoleId: roleId, detail: JSON.stringify({ parentId }) }, affectedUserIds };
		});
	}

	/** Replace a non-system role's permission set. Removed and added permissions must both be within the actor's reach. */
	public async syncPermissions(actor: AuthorizationActor, roleId: string, permissionIds: readonly string[]): Promise<void> {
		const unique: string[] = [...new Set<string>(permissionIds)];
		await this.runner.run(actor, "Sync role permissions", async (tx: Prisma.TransactionClient) => {
			await this.requireMutableRole(actor, roleId, tx);
			await this.escalation.assertCanGrantPermissions(actor, unique, tx);
			if ((await this.permissions.countExisting(unique, tx)) !== unique.length) {
				throw new NotFoundError({ message: "One or more permissions were not found" });
			}
			const affectedUserIds: string[] = await this.holdersOfLineage(roleId, tx);
			await this.assignments.syncRolePermissions(roleId, unique, actor.id, tx);
			return {
				kind: "changed",
				result: undefined,
				audit: { action: "ROLE_PERMISSIONS_SYNCED", targetRoleId: roleId, detail: JSON.stringify({ permissionIds: unique }) },
				affectedUserIds,
			};
		});
	}

	// ── User → role ──────────────────────────────────────────────────────

	/** Assign a role to another user. */
	public async assignToUser(actor: AuthorizationActor, userId: string, roleId: string): Promise<UserRole> {
		return this.runner.run(actor, "Assign role to user", async (tx: Prisma.TransactionClient) => {
			await this.escalation.requireManageableUser(actor, userId, tx);
			await this.requireRole(roleId, tx);
			await this.escalation.assertCanGrantRoles(actor, [roleId], tx);
			const current: string[] = await this.assignments.findAssignedRoleIds(userId, tx);
			this.assertWithinRoleLimit(new Set<string>([...current, roleId]).size);
			const assignment: UserRole = await this.assignments.assignRoleToUser(userId, roleId, actor.id, tx);
			await this.conflicts.assertUsersHaveNoConflicts([userId], tx);
			return { kind: "changed", result: assignment, audit: { action: "ROLE_ASSIGNED", targetUserId: userId, targetRoleId: roleId }, affectedUserIds: [userId] };
		});
	}

	/** Remove a role from another user. Removing a role is as privileged as granting it. */
	public async removeFromUser(actor: AuthorizationActor, userId: string, roleId: string): Promise<void> {
		await this.runner.run(actor, "Remove role from user", async (tx: Prisma.TransactionClient) => {
			await this.escalation.requireManageableUser(actor, userId, tx);
			await this.escalation.assertCanGrantRoles(actor, [roleId], tx);
			if (!(await this.assignments.removeRoleFromUser(userId, roleId, tx))) {
				throw new NotFoundError({ message: `Role ${roleId} is not assigned to user ${userId}` });
			}
			await this.assertProtectedRolesKeepAHolder([roleId], tx);
			return { kind: "changed", result: undefined, audit: { action: "ROLE_REMOVED", targetUserId: userId, targetRoleId: roleId }, affectedUserIds: [userId] };
		});
	}

	/** Replace another user's roles. Every added and every removed role must be within the actor's reach. */
	public async syncUserRoles(actor: AuthorizationActor, userId: string, roleIds: readonly string[]): Promise<void> {
		const desired: string[] = [...new Set<string>(roleIds)];
		this.assertWithinRoleLimit(desired.length);
		await this.runner.run(actor, "Sync user roles", async (tx: Prisma.TransactionClient) => {
			await this.escalation.requireManageableUser(actor, userId, tx);
			for (const roleId of desired) {
				await this.requireRole(roleId, tx);
			}
			const current: string[] = await this.assignments.findAssignedRoleIds(userId, tx);
			const removed: string[] = current.filter((roleId: string): boolean => !desired.includes(roleId));
			const added: string[] = desired.filter((roleId: string): boolean => !current.includes(roleId));
			await this.escalation.assertCanGrantRoles(actor, [...added, ...removed], tx);
			await this.assignments.syncUserRoles(userId, desired, actor.id, tx);
			await this.conflicts.assertUsersHaveNoConflicts([userId], tx);
			await this.assertProtectedRolesKeepAHolder(removed, tx);
			return {
				kind: "changed",
				result: undefined,
				audit: { action: "USER_ROLES_SYNCED", targetUserId: userId, detail: JSON.stringify({ roleIds: desired }) },
				affectedUserIds: [userId],
			};
		});
	}

	// ── Provisioning ─────────────────────────────────────────────────────

	/**
	 * Attach the default consumer role to a self-provisioned account (signup,
	 * merchant onboarding, invite registration). The account acts on its own
	 * behalf; the role is fixed server-side, so no escalation check applies.
	 * Idempotent: an account that already holds the role is left untouched.
	 */
	public async assignDefaultConsumerRole(userId: string): Promise<void> {
		await this.runner.run(selfActor(userId), "Attach the default consumer role at provisioning", async (tx: Prisma.TransactionClient) => {
			const role: Role | null = await this.roles.findByName(DEFAULT_CONSUMER_ROLE_NAME, tx);
			if (role === null) {
				throw new NotFoundError({ message: `Platform role "${DEFAULT_CONSUMER_ROLE_NAME}" is not configured` });
			}
			if (await this.assignments.isRoleAssigned(userId, role.id, tx)) {
				return { kind: "unchanged", result: undefined };
			}
			await this.assignments.assignRoleToUser(userId, role.id, userId, tx);
			await this.conflicts.assertUsersHaveNoConflicts([userId], tx);
			return {
				kind: "changed",
				result: undefined,
				audit: { action: "ROLE_ASSIGNED_AT_PROVISIONING", targetUserId: userId, targetRoleId: role.id },
				affectedUserIds: [userId],
			};
		});
	}

	/**
	 * Assign `roleId` to an account created **in the same transaction** `db`
	 * (e.g. register-and-accept-invite), writing the
	 * `ROLE_ASSIGNED_AT_PROVISIONING` audit row on `db` too.
	 *
	 * No session revocation and no cache invalidation: the account was created
	 * inside `db`, so it has no sessions, no cached authorization and no
	 * tokens to revoke yet. Separation-of-duty rules are still enforced. The
	 * caller owns the transaction (and its system operation) and is
	 * responsible for having authorized the provisioning flow.
	 */
	public async assignToUserAtProvisioningInTx(userId: string, roleId: string, actorId: string, db: Prisma.TransactionClient): Promise<UserRole> {
		await this.requireRole(roleId, db);
		const assignment: UserRole = await this.assignments.assignRoleToUser(userId, roleId, actorId, db);
		await this.conflicts.assertUsersHaveNoConflicts([userId], db);
		await this.audit.record({ action: "ROLE_ASSIGNED_AT_PROVISIONING", actor: { kind: "USER", userId: actorId }, targetUserId: userId, targetRoleId: roleId }, db);
		return assignment;
	}

	// ── Helpers ──────────────────────────────────────────────────────────

	private async requireRole(roleId: string, db: Prisma.TransactionClient): Promise<Role> {
		const role: Role | null = await this.roles.findById(roleId, db);
		if (role === null) {
			throw new NotFoundError({ message: `Role ${roleId} not found` });
		}
		return role;
	}

	/** A live, non-system role the actor neither holds nor lacks the reach for (role-level edits change its holders' permissions). */
	private async requireMutableRole(actor: AuthorizationActor, roleId: string, db: Prisma.TransactionClient): Promise<Role> {
		const role: Role = await this.requireRole(roleId, db);
		if (role.isSystem) {
			throw new AuthorizationError({ message: `"${role.name}" is a system role and cannot be modified` });
		}
		await this.escalation.assertNotHoldingRole(actor, roleId, db);
		await this.escalation.assertCanGrantRoles(actor, [roleId], db);
		return role;
	}

	private assertWithinRoleLimit(roleCount: number): void {
		if (roleCount > MAX_ROLES_PER_USER) {
			throw new ConflictError({ message: `A user can have at most ${String(MAX_ROLES_PER_USER)} roles. Reconsider your role design if more are needed.` });
		}
	}

	/** Holders of `roleId` and of every role inheriting from it (any depth) — everyone whose permissions a role-level change touches. */
	private async holdersOfLineage(roleId: string, db: Prisma.TransactionClient): Promise<string[]> {
		const lineage = new Set<string>([roleId]);
		let frontier: string[] = [roleId];
		while (frontier.length > 0) {
			const children: string[] = await this.roles.findChildIds(frontier, db);
			frontier = children.filter((id: string): boolean => !lineage.has(id));
			for (const id of frontier) {
				lineage.add(id);
			}
		}
		return this.assignments.findActiveHolderIds([...lineage], db);
	}

	/** Whether `startParentId` (or any of its ancestors, whatever their state) is `roleId` itself. */
	private async wouldCreateCycle(roleId: string, startParentId: string, db: Prisma.TransactionClient): Promise<boolean> {
		const visited = new Set<string>();
		let frontier: string[] = [startParentId];
		while (frontier.length > 0) {
			if (frontier.includes(roleId)) {
				return true;
			}
			for (const id of frontier) {
				visited.add(id);
			}
			const links = await this.roles.findParentLinks(frontier, db);
			frontier = links.flatMap((link): string[] => (link.parentId !== null && !visited.has(link.parentId) ? [link.parentId] : []));
		}
		return false;
	}

	/** After removing `removedRoleIds` from someone: every protected system role among them must still have an active holder. */
	private async assertProtectedRolesKeepAHolder(removedRoleIds: readonly string[], db: Prisma.TransactionClient): Promise<void> {
		if (removedRoleIds.length === 0) {
			return;
		}
		const protectedRoles: Role[] = await this.roles.findSystemRolesByName(LAST_HOLDER_PROTECTED_ROLE_NAMES, db);
		for (const role of protectedRoles) {
			if (removedRoleIds.includes(role.id) && (await this.assignments.countActiveHolders(role.id, db)) === 0) {
				throw new ConflictError({ message: `"${role.name}" must keep at least one active holder` });
			}
		}
	}
}

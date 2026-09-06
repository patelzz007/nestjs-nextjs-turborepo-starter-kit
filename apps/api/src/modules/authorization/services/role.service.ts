import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { Permission, Role, UserRole } from "@prisma/client";
import type { PaginationInput } from "@workspace/shared";

import { BaseService } from "../../../platform/persistence/base.service";
import { AuthorizationAuditService } from "../audit/authorization-audit.service";
import { AuthorizationCacheService } from "../cache/authorization-cache.service";
import { AuthorizationEventEmitter } from "../events/authorization.events";
import { RoleAssignmentRepository } from "../repositories/role-assignment.repository";
import { RoleRepository } from "../repositories/role.repository";
import { UserSessionRevocationService } from "./user-session-revocation.service";

// ── Types ───────────────────────────────────────────────────────────────────

export interface CreateRoleInput {
	readonly name: string;
	readonly description?: string;
	readonly parentId?: string;
}

export interface UpdateRoleInput {
	readonly name?: string;
	readonly description?: string;
	readonly isActive?: boolean;
}

// ── Service ─────────────────────────────────────────────────────────────────

/**
 * Role CRUD and role-permission / role-user management.
 *
 * Every mutation wraps the database writes in a Prisma transaction and
 * invalidates the authorization cache for affected users afterwards.
 */
@Injectable()
export class RoleService extends BaseService<Role, CreateRoleInput, UpdateRoleInput, PaginationInput, RoleRepository> {
	private readonly logger: Logger = new Logger(RoleService.name);

	public constructor(
		repository: RoleRepository,
		private readonly assignments: RoleAssignmentRepository,
		private readonly cache: AuthorizationCacheService,
		private readonly audit: AuthorizationAuditService,
		private readonly events: AuthorizationEventEmitter,
		private readonly sessionRevocation: UserSessionRevocationService,
	) {
		super(repository);
	}

	// ── CRUD ─────────────────────────────────────────────────────────────

	/**
	 * Create a new role.
	 *
	 * @throws ConflictException if a role with the same name already exists.
	 */
	public override async create(input: CreateRoleInput): Promise<Role> {
		const existing: Role | null = await this.repository.findByName(input.name);

		if (existing !== null) {
			throw new ConflictException(`Role "${input.name}" already exists`);
		}

		const role: Role = await this.repository.create(input);

		await this.audit.logRoleCreation("system", role.id, role.name);
		this.logger.log(`Created role "${role.name}" (${role.id})`);
		return role;
	}

	/**
	 * Update a role's metadata.
	 *
	 * @throws NotFoundException if the role does not exist.
	 */
	public override async update(roleId: string, input: UpdateRoleInput): Promise<Role> {
		const role: Role | null = await this.repository.findById(roleId);

		if (role === null) {
			throw new NotFoundException(`Role ${roleId} not found`);
		}

		const updated: Role = await this.repository.update(roleId, input);

		await this.invalidateRoleUsers(roleId);

		await this.audit.log({ action: "ROLE_UPDATED", actorId: "system", targetRoleId: roleId, detail: JSON.stringify(input) });
		this.logger.log(`Updated role "${updated.name}" (${updated.id})`);
		return updated;
	}

	/**
	 * Soft-delete a role and cascade the invalidation.
	 *
	 * @throws NotFoundException if the role does not exist.
	 */
	public async remove(roleId: string): Promise<void> {
		const role: Role | null = await this.repository.findById(roleId);

		if (role === null) {
			throw new NotFoundException(`Role ${roleId} not found`);
		}

		const affectedUserIds: string[] = await this.assignments.findActiveUserIdsByRole(roleId);

		await this.repository.delete(roleId);

		if (affectedUserIds.length > 0) {
			await this.sessionRevocation.revokeAllSessionsForUsers(affectedUserIds);
		}

		await this.invalidateRoleUsers(roleId);

		await this.audit.logRoleDeletion("system", roleId, role.name);
		this.logger.log(`Soft-deleted role "${role.name}" (${role.id})`);
	}

	/**
	 * Fetch a role by ID (excluding soft-deleted).
	 */
	public async findById(roleId: string): Promise<Role | null> {
		return this.repository.findById(roleId);
	}

	/**
	 * Fetch a role by name (excluding soft-deleted).
	 */
	public async findByName(name: string): Promise<Role | null> {
		return this.repository.findByName(name);
	}

	/**
	 * Fetch multiple roles by name in a single query (batch).
	 */
	public async findByNames(names: readonly string[]): Promise<Role[]> {
		return this.repository.findByNames(names);
	}

	/**
	 * List all active roles with pagination.
	 */
	public async findAll(options: { readonly page?: number; readonly limit?: number } = {}): Promise<{
		readonly items: Role[];
		readonly total: number;
	}> {
		const page: number = options.page ?? 1;
		const limit: number = options.limit ?? 50;
		const result = await this.repository.list({ page, limit });
		return { items: [...result.items], total: result.total };
	}

	// ── Role → Permission management ─────────────────────────────────────

	/**
	 * Give a permission to a role (idempotent).
	 */
	public async givePermissionTo(roleId: string, permissionId: string, actorId = "system"): Promise<void> {
		await this.ensureRoleAndPermissionExist(roleId, permissionId);

		await this.assignments.givePermissionToRole(roleId, permissionId);

		await this.invalidateRoleUsers(roleId);
		await this.audit.log({ action: "PERMISSION_GRANTED_TO_ROLE", actorId, targetRoleId: roleId, permissionId });
	}

	/**
	 * Revoke a permission from a role.
	 */
	public async revokePermissionFrom(roleId: string, permissionId: string, actorId = "system"): Promise<void> {
		await this.assignments.revokePermissionFromRole(roleId, permissionId);

		await this.invalidateRoleUsers(roleId);
		await this.audit.log({ action: "PERMISSION_REVOKED_FROM_ROLE", actorId, targetRoleId: roleId, permissionId });
	}

	/**
	 * Sync (replace) all permissions on a role.
	 */
	public async syncPermissions(roleId: string, permissionIds: readonly string[]): Promise<void> {
		await this.assignments.syncRolePermissions(roleId, permissionIds);

		await this.invalidateRoleUsers(roleId);
	}

	// ── Role → User assignment ───────────────────────────────────────────

	/**
	 * Assign a role to a user (idempotent).
	 */
	public async assignToUser(userId: string, roleId: string, actorId = "system"): Promise<UserRole> {
		await this.ensureRoleExists(roleId);

		const result: UserRole = await this.assignments.assignRoleToUser(userId, roleId);

		await this.sessionRevocation.revokeAllSessionsForUser(userId);
		this.cache.invalidate(userId);
		this.events.emitUsersMeInvalidate([userId]);
		await this.audit.logRoleAssignment(actorId, userId, roleId);
		return result;
	}

	/**
	 * Remove a role from a user.
	 */
	public async removeFromUser(userId: string, roleId: string, actorId = "system"): Promise<void> {
		await this.assignments.removeRoleFromUser(userId, roleId);

		await this.sessionRevocation.revokeAllSessionsForUser(userId);
		this.cache.invalidate(userId);
		this.events.emitUsersMeInvalidate([userId]);
		await this.audit.logRoleRemoval(actorId, userId, roleId);
	}

	/**
	 * Sync (replace) all roles on a user.
	 */
	public async syncUserRoles(userId: string, roleIds: readonly string[]): Promise<void> {
		if (roleIds.length > 10) {
			throw new ConflictException("A user can have at most 10 roles. Reconsider your role design if more are needed.");
		}
		await this.assignments.syncUserRoles(userId, roleIds);

		await this.sessionRevocation.revokeAllSessionsForUser(userId);
		this.cache.invalidate(userId);
		this.events.emitUsersMeInvalidate([userId]);
	}

	// ── Restore ──────────────────────────────────────────────────────

	/**
	 * Restore a soft-deleted role.
	 */
	public override async restore(roleId: string): Promise<Role> {
		const role: Role | null = await this.repository.findDeletedById(roleId);

		if (role === null) {
			throw new NotFoundException(`Deleted role ${roleId} not found`);
		}

		const updated: Role = await super.restore(roleId);

		this.cache.invalidateHierarchy();
		this.logger.log(`Restored role "${updated.name}" (${updated.id})`);
		return updated;
	}

	// ── Parent / hierarchy ───────────────────────────────────────────────

	/**
	 * Set (or clear) the parent role for hierarchy inheritance.
	 */
	public async setParent(roleId: string, parentId: string | null): Promise<Role> {
		const role: Role | null = await this.findById(roleId);
		if (role === null) {
			throw new NotFoundException(`Role ${roleId} not found`);
		}

		if (parentId !== null) {
			const parent: Role | null = await this.findById(parentId);
			if (parent === null) {
				throw new NotFoundException(`Parent role ${parentId} not found`);
			}

			const hasCycle: boolean = await this.detectCycle(roleId, parentId);
			if (hasCycle) {
				throw new ConflictException(`Setting "${parent.name}" as parent of "${role.name}" would create a circular hierarchy`);
			}
		}

		const updated: Role = await this.repository.setParent(roleId, parentId);

		await this.invalidateRoleUsers(roleId);
		return updated;
	}

	private async detectCycle(targetRoleId: string, startParentId: string): Promise<boolean> {
		let frontier: string[] = [startParentId];
		const visited: Set<string> = new Set<string>();

		while (frontier.length > 0) {
			const nextFrontier: string[] = [];
			for (const roleId of frontier) {
				if (roleId === targetRoleId) {
					return true;
				}
				if (visited.has(roleId)) {
					continue;
				}
				visited.add(roleId);
				const ancestors = await this.repository.findAncestorsWithParent(roleId);
				for (const ancestor of ancestors) {
					if (ancestor.parentId !== null) {
						nextFrontier.push(ancestor.parentId);
					}
				}
			}
			frontier = nextFrontier;
		}
		return false;
	}

	private async invalidateRoleUsers(roleId: string): Promise<void> {
		const userIds: string[] = await this.assignments.findActiveUserIdsByRole(roleId);
		if (userIds.length > 0) {
			this.cache.invalidateUsers(userIds);
			await this.sessionRevocation.revokeAllSessionsForUsers(userIds);
			this.events.emitUsersMeInvalidate(userIds);
		}
	}

	private async ensureRoleExists(roleId: string): Promise<void> {
		const role: Role | null = await this.findById(roleId);
		if (role === null) {
			throw new NotFoundException(`Role ${roleId} not found`);
		}
	}

	private async ensureRoleAndPermissionExist(roleId: string, permissionId: string): Promise<void> {
		await this.ensureRoleExists(roleId);

		const perm: Permission | null = await this.assignments.findPermissionById(permissionId);

		if (perm === null) {
			throw new NotFoundException(`Permission ${permissionId} not found`);
		}
	}
}

import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { Permission, Role, UserRole } from "@prisma/client";
import { nowEpochMs } from "@workspace/shared";

import { PrismaService } from "../../../prisma/prisma.service";
import { AuthorizationAuditService } from "../audit/authorization-audit.service";
import { AuthorizationCacheService } from "../cache/authorization-cache.service";
import { AuthorizationEventEmitter } from "../events/authorization.events";

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
export class RoleService {
	private readonly logger: Logger = new Logger(RoleService.name);

	public constructor(
		private readonly prisma: PrismaService,
		private readonly cache: AuthorizationCacheService,
		private readonly audit: AuthorizationAuditService,
		private readonly events: AuthorizationEventEmitter,
	) {}

	// ── CRUD ─────────────────────────────────────────────────────────────

	/**
	 * Create a new role.
	 *
	 * @throws ConflictException if a role with the same name already exists.
	 */
	public async create(input: CreateRoleInput): Promise<Role> {
		const existing: Role | null = await this.prisma.role.findFirst({
			where: { name: input.name, isDeleted: false },
		});

		if (existing !== null) {
			throw new ConflictException(`Role "${input.name}" already exists`);
		}

		const role: Role = await this.prisma.role.create({
			data: {
				name: input.name,
				description: input.description ?? null,
				parentId: input.parentId ?? null,
			},
		});

		await this.audit.logRoleCreation("system", role.id, role.name);
		this.logger.log(`Created role "${role.name}" (${role.id})`);
		return role;
	}

	/**
	 * Update a role's metadata.
	 *
	 * @throws NotFoundException if the role does not exist.
	 */
	public async update(roleId: string, input: UpdateRoleInput): Promise<Role> {
		const role: Role | null = await this.prisma.role.findFirst({
			where: { id: roleId, isDeleted: false },
		});

		if (role === null) {
			throw new NotFoundException(`Role ${roleId} not found`);
		}

		const updated: Role = await this.prisma.role.update({
			where: { id: roleId },
			data: {
				...(input.name !== undefined ? { name: input.name } : {}),
				...(input.description !== undefined ? { description: input.description } : {}),
				...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
			},
		});

		// Invalidate all users who held this role
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
		const role: Role | null = await this.prisma.role.findFirst({
			where: { id: roleId, isDeleted: false },
		});

		if (role === null) {
			throw new NotFoundException(`Role ${roleId} not found`);
		}

		// Collect affected user IDs BEFORE deletion (needed for token version bump)
		const affectedUserRoles = await this.prisma.userRole.findMany({
			where: { roleId, isDeleted: false },
			select: { userId: true },
		});
		const affectedUserIds: string[] = affectedUserRoles.map((ur) => ur.userId);

		await this.prisma.role.update({
			where: { id: roleId },
			data: { isDeleted: true, deletedAt: nowEpochMs() },
		});

		// Bump tokenVersion for all affected users so their JWTs are rejected
		if (affectedUserIds.length > 0) {
			await this.prisma.user.updateMany({
				where: { id: { in: affectedUserIds } },
				data: { tokenVersion: { increment: 1 } },
			});
		}

		await this.invalidateRoleUsers(roleId);

		await this.audit.logRoleDeletion("system", roleId, role.name);
		this.logger.log(`Soft-deleted role "${role.name}" (${role.id})`);
	}

	/**
	 * Fetch a role by ID (excluding soft-deleted).
	 */
	public async findById(roleId: string): Promise<Role | null> {
		return this.prisma.role.findFirst({
			where: { id: roleId, isDeleted: false },
		});
	}

	/**
	 * Fetch a role by name (excluding soft-deleted).
	 */
	public async findByName(name: string): Promise<Role | null> {
		return this.prisma.role.findFirst({
			where: { name, isDeleted: false },
		});
	}

	/**
	 * Fetch multiple roles by name in a single query (batch).
	 */
	public async findByNames(names: readonly string[]): Promise<Role[]> {
		if (names.length === 0) {
			return [];
		}
		return this.prisma.role.findMany({
			where: { name: { in: [...names] }, isDeleted: false },
		});
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
		const skip: number = (page - 1) * limit;

		const [items, total] = await Promise.all([
			this.prisma.role.findMany({
				where: { isDeleted: false },
				orderBy: { name: "asc" },
				skip,
				take: limit,
			}),
			this.prisma.role.count({ where: { isDeleted: false } }),
		]);

		return { items, total };
	}

	// ── Role → Permission management ─────────────────────────────────────

	/**
	 * Give a permission to a role (idempotent).
	 */
	public async givePermissionTo(roleId: string, permissionId: string, actorId = "system"): Promise<void> {
		await this.ensureRoleAndPermissionExist(roleId, permissionId);

		await this.prisma.rolePermission.upsert({
			where: { roleId_permissionId: { roleId, permissionId } },
			create: { roleId, permissionId },
			update: { isDeleted: false, deletedAt: null },
		});

		await this.invalidateRoleUsers(roleId);
		await this.audit.log({ action: "PERMISSION_GRANTED_TO_ROLE", actorId, targetRoleId: roleId, permissionId });
	}

	/**
	 * Revoke a permission from a role.
	 */
	public async revokePermissionFrom(roleId: string, permissionId: string, actorId = "system"): Promise<void> {
		await this.prisma.rolePermission.updateMany({
			where: { roleId, permissionId, isDeleted: false },
			data: { isDeleted: true, deletedAt: nowEpochMs() },
		});

		await this.invalidateRoleUsers(roleId);
		await this.audit.log({ action: "PERMISSION_REVOKED_FROM_ROLE", actorId, targetRoleId: roleId, permissionId });
	}

	/**
	 * Sync (replace) all permissions on a role.
	 *
	 * Wrapped in a transaction: delete existing → create new.
	 */
	public async syncPermissions(roleId: string, permissionIds: readonly string[]): Promise<void> {
		await this.prisma.$transaction(async (tx) => {
			await tx.rolePermission.updateMany({
				where: { roleId, isDeleted: false },
				data: { isDeleted: true, deletedAt: nowEpochMs() },
			});

			if (permissionIds.length > 0) {
				await tx.rolePermission.createMany({
					data: permissionIds.map((pid) => ({ roleId, permissionId: pid })),
					skipDuplicates: true,
				});
			}
		});

		await this.invalidateRoleUsers(roleId);
	}

	// ── Role → User assignment ───────────────────────────────────────────

	/**
	 * Assign a role to a user (idempotent).
	 */
	public async assignToUser(userId: string, roleId: string, actorId = "system"): Promise<UserRole> {
		await this.ensureRoleExists(roleId);

		const result: UserRole = await this.prisma.userRole.upsert({
			where: { userId_roleId: { userId, roleId } },
			create: { userId, roleId },
			update: { isDeleted: false, deletedAt: null },
		});

		await this.bumpTokenVersion(userId);
		this.cache.invalidate(userId);
		this.events.emitUsersMeInvalidate([userId]);
		await this.audit.logRoleAssignment(actorId, userId, roleId);
		return result;
	}

	/**
	 * Remove a role from a user.
	 */
	public async removeFromUser(userId: string, roleId: string, actorId = "system"): Promise<void> {
		await this.prisma.userRole.updateMany({
			where: { userId, roleId, isDeleted: false },
			data: { isDeleted: true, deletedAt: nowEpochMs() },
		});

		await this.bumpTokenVersion(userId);
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
		await this.prisma.$transaction(async (tx) => {
			await tx.userRole.updateMany({
				where: { userId, isDeleted: false },
				data: { isDeleted: true, deletedAt: nowEpochMs() },
			});

			if (roleIds.length > 0) {
				await tx.userRole.createMany({
					data: roleIds.map((rid) => ({ userId, roleId: rid })),
					skipDuplicates: true,
				});
			}

			await tx.user.update({
				where: { id: userId },
				data: { tokenVersion: { increment: 1 } },
			});
		});

		this.cache.invalidate(userId);
		this.events.emitUsersMeInvalidate([userId]);
	}

	/**
	 * Increment the user's `tokenVersion` so any outstanding JWTs are
	 * rejected by the AuthorizationGuard on the next request.
	 */
	private async bumpTokenVersion(userId: string): Promise<void> {
		await this.prisma.user.update({
			where: { id: userId },
			data: { tokenVersion: { increment: 1 } },
		});
	}

	// ── Restore ──────────────────────────────────────────────────────

	/**
	 * Restore a soft-deleted role.
	 */
	public async restore(roleId: string): Promise<Role> {
		const role: Role | null = await this.prisma.role.findFirst({
			where: { id: roleId, isDeleted: true },
		});

		if (role === null) {
			throw new NotFoundException(`Deleted role ${roleId} not found`);
		}

		const updated: Role = await this.prisma.role.update({
			where: { id: roleId },
			data: { isDeleted: false, deletedAt: null, isActive: true },
		});

		this.cache.invalidateHierarchy();
		this.logger.log(`Restored role "${updated.name}" (${updated.id})`);
		return updated;
	}

	// ── Parent / hierarchy ───────────────────────────────────────────────

	/**
	 * Set (or clear) the parent role for hierarchy inheritance.
	 *
	 * Performs a full DFS cycle detection — walks the entire ancestor chain
	 * from `parentId` upward to ensure setting it won't create a cycle.
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

			// Full DFS cycle detection: walk ancestors from parentId
			// to ensure roleId isn't already in the chain.
			const hasCycle: boolean = await this.detectCycle(roleId, parentId);
			if (hasCycle) {
				throw new ConflictException(`Setting "${parent.name}" as parent of "${role.name}" would create a circular hierarchy`);
			}
		}

		const updated: Role = await this.prisma.role.update({
			where: { id: roleId },
			data: { parentId },
		});

		await this.invalidateRoleUsers(roleId);
		return updated;
	}

	/**
	 * DFS walk from `startParentId` upward. Returns `true` if `targetRoleId`
	 * is found in the ancestor chain (i.e., setting target → start would cycle).
	 */
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
				const ancestors = await this.prisma.role.findMany({
					where: { id: roleId, isDeleted: false, parentId: { not: null } },
					select: { parentId: true },
				});
				for (const a of ancestors) {
					if (a.parentId !== null) {
						nextFrontier.push(a.parentId);
					}
				}
			}
			frontier = nextFrontier;
		}
		return false;
	}

	// ── Internal helpers ─────────────────────────────────────────────────

	/**
	 * Find all user IDs that hold a given role, then invalidate their caches.
	 */
	private async invalidateRoleUsers(roleId: string): Promise<void> {
		const userRoles: Pick<UserRole, "userId">[] = await this.prisma.userRole.findMany({
			where: { roleId, isDeleted: false },
			select: { userId: true },
		});

		const userIds: string[] = userRoles.map((ur) => ur.userId);
		if (userIds.length > 0) {
			this.cache.invalidateUsers(userIds);
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

		const perm: Permission | null = await this.prisma.permission.findFirst({
			where: { id: permissionId, isDeleted: false },
		});

		if (perm === null) {
			throw new NotFoundException(`Permission ${permissionId} not found`);
		}
	}
}

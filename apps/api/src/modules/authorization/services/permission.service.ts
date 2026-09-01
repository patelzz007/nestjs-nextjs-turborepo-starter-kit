import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { Permission, UserPermission } from "@prisma/client";
import { nowEpochMs, type PermissionAction, type PermissionResource } from "@workspace/shared";

import { PrismaService } from "../../../prisma/prisma.service";
import { AuthorizationAuditService } from "../audit/authorization-audit.service";
import { AuthorizationCacheService } from "../cache/authorization-cache.service";
import { AuthorizationEventEmitter } from "../events/authorization.events";

// ── Types ───────────────────────────────────────────────────────────────────

export interface CreatePermissionInput {
	readonly action: PermissionAction;
	readonly resource: PermissionResource;
	readonly description?: string;
	readonly group?: string;
	readonly isSystem?: boolean;
}

export interface UpdatePermissionInput {
	readonly description?: string;
	readonly group?: string;
	readonly isSystem?: boolean;
}

// ── Service ─────────────────────────────────────────────────────────────────

/**
 * Permission CRUD and direct user-permission grants.
 */
@Injectable()
export class PermissionService {
	private readonly logger: Logger = new Logger(PermissionService.name);

	public constructor(
		private readonly prisma: PrismaService,
		private readonly cache: AuthorizationCacheService,
		private readonly audit: AuthorizationAuditService,
		private readonly events: AuthorizationEventEmitter,
	) {}

	// ── CRUD ─────────────────────────────────────────────────────────────

	/**
	 * Create a new permission.
	 *
	 * @throws ConflictException if the action+resource pair already exists.
	 */
	public async create(input: CreatePermissionInput): Promise<Permission> {
		const existing: Permission | null = await this.prisma.permission.findFirst({
			where: { action: input.action, resource: input.resource, isDeleted: false },
		});

		if (existing !== null) {
			throw new ConflictException(`Permission ${input.action}:${input.resource} already exists`);
		}

		const permission: Permission = await this.prisma.permission.create({
			data: {
				action: input.action,
				resource: input.resource,
				description: input.description ?? null,
				group: input.group ?? null,
				isSystem: input.isSystem ?? false,
			},
		});

		await this.audit.logPermissionCreation("system", permission.id, `${permission.action}:${permission.resource}`);
		this.logger.log(`Created permission ${permission.action}:${permission.resource} (${permission.id})`);
		return permission;
	}

	/**
	 * Update a permission's metadata (description, group, etc.).
	 *
	 * Action and resource are immutable — create a new permission instead.
	 */
	public async update(permissionId: string, input: UpdatePermissionInput): Promise<Permission> {
		const permission: Permission | null = await this.findById(permissionId);
		if (permission === null) {
			throw new NotFoundException(`Permission ${permissionId} not found`);
		}

		const updated: Permission = await this.prisma.permission.update({
			where: { id: permissionId },
			data: {
				...(input.description !== undefined ? { description: input.description } : {}),
				...(input.group !== undefined ? { group: input.group } : {}),
				...(input.isSystem !== undefined ? { isSystem: input.isSystem } : {}),
			},
		});

		// Invalidate users who hold this permission via roles or directly
		await this.invalidatePermissionUsers(permissionId);

		this.logger.log(`Updated permission ${updated.action}:${updated.resource} (${updated.id})`);
		return updated;
	}

	/**
	 * Soft-delete a permission.
	 */
	public async remove(permissionId: string): Promise<void> {
		const permission: Permission | null = await this.findById(permissionId);
		if (permission === null) {
			throw new NotFoundException(`Permission ${permissionId} not found`);
		}

		await this.prisma.permission.update({
			where: { id: permissionId },
			data: { isDeleted: true, deletedAt: nowEpochMs() },
		});

		await this.invalidatePermissionUsers(permissionId);

		await this.audit.logPermissionDeletion("system", permissionId, `${permission.action}:${permission.resource}`);
		this.logger.log(`Soft-deleted permission ${permission.action}:${permission.resource} (${permission.id})`);
	}

	/**
	 * Restore a soft-deleted permission.
	 */
	public async restore(permissionId: string): Promise<Permission> {
		const permission: Permission | null = await this.prisma.permission.findFirst({
			where: { id: permissionId, isDeleted: true },
		});

		if (permission === null) {
			throw new NotFoundException(`Deleted permission ${permissionId} not found`);
		}

		const updated: Permission = await this.prisma.permission.update({
			where: { id: permissionId },
			data: { isDeleted: false, deletedAt: null },
		});

		await this.invalidatePermissionUsers(permissionId);
		this.logger.log(`Restored permission ${updated.action}:${updated.resource} (${updated.id})`);
		return updated;
	}

	/**
	 * Fetch a permission by ID.
	 */
	public async findById(permissionId: string): Promise<Permission | null> {
		return this.prisma.permission.findFirst({
			where: { id: permissionId, isDeleted: false },
		});
	}

	/**
	 * Fetch a permission by action + resource.
	 */
	public async findByActionResource(action: PermissionAction, resource: PermissionResource): Promise<Permission | null> {
		return this.prisma.permission.findFirst({
			where: { action, resource, isDeleted: false },
		});
	}

	/**
	 * List all permissions with optional filters.
	 */
	public async findAll(
		filters: {
			readonly resource?: PermissionResource;
			readonly action?: PermissionAction;
			readonly group?: string;
			readonly page?: number;
			readonly limit?: number;
		} = {},
	): Promise<{ readonly items: Permission[]; readonly total: number }> {
		const page: number = filters.page ?? 1;
		const limit: number = filters.limit ?? 50;
		const skip: number = (page - 1) * limit;

		const where = {
			isDeleted: false,
			...(filters.resource !== undefined ? { resource: filters.resource } : {}),
			...(filters.action !== undefined ? { action: filters.action } : {}),
			...(filters.group !== undefined ? { group: filters.group } : {}),
		};

		const [items, total] = await Promise.all([
			this.prisma.permission.findMany({
				where,
				orderBy: [{ resource: "asc" }, { action: "asc" }],
				skip,
				take: limit,
			}),
			this.prisma.permission.count({ where }),
		]);

		return { items, total };
	}

	/**
	 * List distinct permission groups.
	 */
	public async listGroups(): Promise<string[]> {
		const result = await this.prisma.permission.findMany({
			where: { isDeleted: false, group: { not: null } },
			select: { group: true },
			distinct: ["group"],
		});

		return result.map((r) => r.group ?? "").filter((g) => g.length > 0);
	}

	// ── Direct user-permission grants ────────────────────────────────────

	/**
	 * Give a direct permission to a user (idempotent).
	 */
	public async giveToUser(userId: string, permissionId: string, expiresAt?: number, actorId = "system"): Promise<UserPermission> {
		const permission: Permission | null = await this.findById(permissionId);
		if (permission === null) {
			throw new NotFoundException(`Permission ${permissionId} not found`);
		}

		const result: UserPermission = await this.prisma.userPermission.upsert({
			where: { userId_permissionId: { userId, permissionId } },
			create: {
				userId,
				permissionId,
				expiresAt: expiresAt ?? null,
			},
			update: {
				isDeleted: false,
				deletedAt: null,
				...(expiresAt !== undefined ? { expiresAt } : {}),
			},
		});

		await this.bumpTokenVersion(userId);
		this.cache.invalidate(userId);
		this.events.emitUsersMeInvalidate([userId]);
		await this.audit.logPermissionGrant(actorId, userId, permissionId);
		return result;
	}

	/**
	 * Revoke a direct permission from a user.
	 */
	public async revokeFromUser(userId: string, permissionId: string, actorId = "system"): Promise<void> {
		await this.prisma.userPermission.updateMany({
			where: { userId, permissionId, isDeleted: false },
			data: { isDeleted: true, deletedAt: nowEpochMs() },
		});

		await this.bumpTokenVersion(userId);
		this.cache.invalidate(userId);
		this.events.emitUsersMeInvalidate([userId]);
		await this.audit.logPermissionRevocation(actorId, userId, permissionId);
	}

	/**
	 * Sync (replace) all direct permissions on a user.
	 */
	public async syncUserPermissions(userId: string, permissionIds: readonly string[]): Promise<void> {
		await this.prisma.$transaction(async (tx) => {
			await tx.userPermission.updateMany({
				where: { userId, isDeleted: false },
				data: { isDeleted: true, deletedAt: nowEpochMs() },
			});

			if (permissionIds.length > 0) {
				await tx.userPermission.createMany({
					data: permissionIds.map((pid) => ({ userId, permissionId: pid })),
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

	// ── Internal helpers ─────────────────────────────────────────────────

	/**
	 * Find all user IDs affected by a permission change (via roles and direct grants),
	 * then invalidate their caches.
	 */
	private async invalidatePermissionUsers(permissionId: string): Promise<void> {
		const [rolePerms, directPerms] = await Promise.all([
			this.prisma.rolePermission.findMany({
				where: { permissionId, isDeleted: false },
				select: { roleId: true },
			}),
			this.prisma.userPermission.findMany({
				where: { permissionId, isDeleted: false },
				select: { userId: true },
			}),
		]);

		// Collect user IDs from direct grants
		const userIds: Set<string> = new Set<string>(directPerms.map((dp) => dp.userId));

		// Collect user IDs from role assignments
		if (rolePerms.length > 0) {
			const roleIds: string[] = rolePerms.map((rp) => rp.roleId);
			const userRoles = await this.prisma.userRole.findMany({
				where: { roleId: { in: roleIds }, isDeleted: false },
				select: { userId: true },
			});
			for (const ur of userRoles) {
				userIds.add(ur.userId);
			}
		}

		if (userIds.size > 0) {
			const ids: string[] = Array.from(userIds);
			this.cache.invalidateUsers(ids);
			this.events.emitUsersMeInvalidate(ids);
		}
	}
}

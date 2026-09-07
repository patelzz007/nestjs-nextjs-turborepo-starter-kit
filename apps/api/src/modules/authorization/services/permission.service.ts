import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { Permission, UserPermission } from "@prisma/client";
import type { PaginatedServiceResult, PermissionAction, PermissionResource } from "@workspace/shared";

import { BaseService } from "../../../platform/persistence/base.service";
import { AuthorizationAuditService } from "../audit/authorization-audit.service";
import { AuthorizationCacheService } from "../cache/authorization-cache.service";
import { AuthorizationEventEmitter } from "../events/authorization.events";
import { PermissionListQuery, PermissionRepository } from "../repositories/permission.repository";
import { RoleAssignmentRepository } from "../repositories/role-assignment.repository";
import { UserSessionRevocationService } from "./user-session-revocation.service";

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
export class PermissionService extends BaseService<Permission, CreatePermissionInput, UpdatePermissionInput, PermissionListQuery, PermissionRepository> {
	private readonly logger: Logger = new Logger(PermissionService.name);

	public constructor(
		repository: PermissionRepository,
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
	 * Create a new permission.
	 *
	 * @throws ConflictException if the action+resource pair already exists.
	 */
	public override async create(input: CreatePermissionInput): Promise<Permission> {
		const existing: Permission | null = await this.repository.findByActionResource(input.action, input.resource);

		if (existing !== null) {
			throw new ConflictException(`Permission ${input.action}:${input.resource} already exists`);
		}

		const permission: Permission = await this.repository.create(input);

		await this.audit.logPermissionCreation("system", permission.id, `${permission.action}:${permission.resource}`);
		this.logger.log(`Created permission ${permission.action}:${permission.resource} (${permission.id})`);
		return permission;
	}

	/**
	 * Update a permission's metadata (description, group, etc.).
	 */
	public override async update(permissionId: string, input: UpdatePermissionInput): Promise<Permission> {
		const permission: Permission | null = await this.findById(permissionId);
		if (permission === null) {
			throw new NotFoundException(`Permission ${permissionId} not found`);
		}

		const updated: Permission = await this.repository.update(permissionId, input);

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

		await this.repository.delete(permissionId);

		await this.invalidatePermissionUsers(permissionId);

		await this.audit.logPermissionDeletion("system", permissionId, `${permission.action}:${permission.resource}`);
		this.logger.log(`Soft-deleted permission ${permission.action}:${permission.resource} (${permission.id})`);
	}

	/**
	 * Restore a soft-deleted permission.
	 */
	public override async restore(permissionId: string): Promise<Permission> {
		const permission: Permission | null = await this.repository.findDeletedById(permissionId);

		if (permission === null) {
			throw new NotFoundException(`Deleted permission ${permissionId} not found`);
		}

		const updated: Permission = await super.restore(permissionId);

		await this.invalidatePermissionUsers(permissionId);
		this.logger.log(`Restored permission ${updated.action}:${updated.resource} (${updated.id})`);
		return updated;
	}

	/**
	 * Fetch a permission by ID.
	 */
	public async findById(permissionId: string): Promise<Permission | null> {
		return this.repository.findById(permissionId);
	}

	/**
	 * Fetch a permission by action + resource.
	 */
	public async findByActionResource(action: PermissionAction, resource: PermissionResource): Promise<Permission | null> {
		return this.repository.findByActionResource(action, resource);
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
			readonly cursor?: string;
			readonly limit?: number;
		} = {},
	): Promise<PaginatedServiceResult<Permission>> {
		const limit: number = filters.limit ?? 50;
		const result = await this.repository.list({
			page: filters.page ?? 1,
			limit,
			cursor: filters.cursor,
			resource: filters.resource,
			action: filters.action,
			group: filters.group,
		});
		return this.paginateListResult(result, { page: filters.page ?? 1, limit, cursor: filters.cursor });
	}

	/**
	 * List distinct permission groups.
	 */
	public async listGroups(): Promise<string[]> {
		return this.repository.listGroups();
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

		const result: UserPermission = await this.assignments.givePermissionToUser(userId, permissionId, expiresAt);

		await this.sessionRevocation.revokeAllSessionsForUser(userId);
		this.cache.invalidate(userId);
		this.events.emitUsersMeInvalidate([userId]);
		await this.audit.logPermissionGrant(actorId, userId, permissionId);
		return result;
	}

	/**
	 * Revoke a direct permission from a user.
	 */
	public async revokeFromUser(userId: string, permissionId: string, actorId = "system"): Promise<void> {
		await this.assignments.revokePermissionFromUser(userId, permissionId);

		await this.sessionRevocation.revokeAllSessionsForUser(userId);
		this.cache.invalidate(userId);
		this.events.emitUsersMeInvalidate([userId]);
		await this.audit.logPermissionRevocation(actorId, userId, permissionId);
	}

	/**
	 * Sync (replace) all direct permissions on a user.
	 */
	public async syncUserPermissions(userId: string, permissionIds: readonly string[]): Promise<void> {
		await this.assignments.syncUserPermissions(userId, permissionIds);

		await this.sessionRevocation.revokeAllSessionsForUser(userId);
		this.cache.invalidate(userId);
		this.events.emitUsersMeInvalidate([userId]);
	}

	private async invalidatePermissionUsers(permissionId: string): Promise<void> {
		const userIds: string[] = await this.assignments.findAffectedUserIdsByPermission(permissionId);

		if (userIds.length > 0) {
			this.cache.invalidateUsers(userIds);
			await this.sessionRevocation.revokeAllSessionsForUsers(userIds);
			this.events.emitUsersMeInvalidate(userIds);
		}
	}
}

import { Injectable, Logger } from "@nestjs/common";
import type { AclEffect, Permission, Prisma, UserPermission } from "@prisma/client";
import type { PaginatedServiceResult, PermissionAction, PermissionResource } from "@workspace/shared";

import { AuthorizationError, ConflictError, NotFoundError } from "../../../common/errors/app-error";
import { toPaginatedServiceResult } from "../../../platform/persistence/list-page";
import { PermissionRepository, type CreatePermissionInput, type PermissionListQuery, type UpdatePermissionInput } from "../repositories/permission.repository";
import { RoleAssignmentRepository } from "../repositories/role-assignment.repository";
import { ConflictDetectionService } from "./conflict-detection.service";
import { PrivilegeEscalationService, type AuthorizationActor } from "./privilege-escalation.service";
import { RbacMutationRunner } from "./rbac-mutation.runner";

export type { CreatePermissionInput, UpdatePermissionInput };

/** Default page size for the internal permission catalog read. */
const DEFAULT_PERMISSION_PAGE_LIMIT = 50;

/** A direct grant (or DENY override) for one user. */
export interface GrantPermissionToUserInput {
	readonly userId: string;
	readonly permissionId: string;
	readonly effect: AclEffect;
	/** Epoch ms; `undefined` keeps an existing expiry on re-grant (none for a new grant). */
	readonly expiresAt: number | undefined;
}

/**
 * Permission catalog and direct user grants / DENY overrides.
 *
 * Every mutation requires the authenticated actor and runs inside
 * {@link RbacMutationRunner} (escalation checks + write + session revocation
 * + audit row in one transaction; cache invalidation after commit).
 *
 * System permissions (`isSystem`, synced from the code registry) cannot be
 * edited or deleted through this service, and no caller can create one.
 */
@Injectable()
export class PermissionService {
	private readonly logger: Logger = new Logger(PermissionService.name);

	public constructor(
		private readonly permissions: PermissionRepository,
		private readonly assignments: RoleAssignmentRepository,
		private readonly escalation: PrivilegeEscalationService,
		private readonly conflicts: ConflictDetectionService,
		private readonly runner: RbacMutationRunner,
	) {}

	// ── Reads ────────────────────────────────────────────────────────────

	public async findById(permissionId: string): Promise<Permission | null> {
		return this.permissions.findById(permissionId);
	}

	public async findByActionResource(action: PermissionAction, resource: PermissionResource): Promise<Permission | null> {
		return this.permissions.findByActionResource(action, resource);
	}

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
		const query: PermissionListQuery = {
			page: filters.page ?? 1,
			limit: filters.limit ?? DEFAULT_PERMISSION_PAGE_LIMIT,
			cursor: filters.cursor,
			resource: filters.resource,
			action: filters.action,
			group: filters.group,
		};
		return toPaginatedServiceResult(await this.permissions.list(query), query);
	}

	public async listGroups(): Promise<string[]> {
		return this.permissions.listGroups();
	}

	// ── Catalog ──────────────────────────────────────────────────────────

	/** Create a (non-system) catalog permission. Nobody holds it yet, so no session is affected. */
	public async create(actor: AuthorizationActor, input: CreatePermissionInput): Promise<Permission> {
		const permission: Permission = await this.runner.run(actor, "Create permission", async (tx: Prisma.TransactionClient) => {
			if ((await this.permissions.findAnyByActionResource(input.action, input.resource, tx)) !== null) {
				throw new ConflictError({ message: `Permission ${input.action}:${input.resource} already exists (restore it if it was deleted)` });
			}
			const created: Permission = await this.permissions.create(input, tx);
			return { kind: "changed", result: created, audit: { action: "PERMISSION_CREATED", permissionId: created.id, detail: JSON.stringify(input) }, affectedUserIds: [] };
		});
		this.logger.log(`Created permission ${permission.action}:${permission.resource} (${permission.id})`);
		return permission;
	}

	/** Edit a non-system permission's metadata (description / group). Metadata never changes anyone's access. */
	public async update(actor: AuthorizationActor, permissionId: string, input: UpdatePermissionInput): Promise<Permission> {
		return this.runner.run(actor, "Update permission", async (tx: Prisma.TransactionClient) => {
			await this.requireMutablePermission(permissionId, tx);
			const updated: Permission = await this.permissions.update(permissionId, input, tx);
			return { kind: "changed", result: updated, audit: { action: "PERMISSION_UPDATED", permissionId, detail: JSON.stringify(input) }, affectedUserIds: [] };
		});
	}

	/** Soft-delete a non-system permission. It disappears from every holder, so the actor must hold it. */
	public async remove(actor: AuthorizationActor, permissionId: string): Promise<void> {
		await this.runner.run(actor, "Delete permission", async (tx: Prisma.TransactionClient) => {
			const permission: Permission = await this.requireMutablePermission(permissionId, tx);
			await this.escalation.assertHoldsPermissionPairs(actor, [permission]);
			const affectedUserIds: string[] = await this.assignments.findAffectedUserIdsByPermission(permissionId, tx);
			await this.permissions.softDelete(permissionId, tx);
			return {
				kind: "changed",
				result: undefined,
				audit: { action: "PERMISSION_DELETED", permissionId, detail: `${permission.action}:${permission.resource}` },
				affectedUserIds,
			};
		});
	}

	/** Restore a soft-deleted permission. Every role and user still assigned it regains it, so the actor must hold it. */
	public async restore(actor: AuthorizationActor, permissionId: string): Promise<Permission> {
		return this.runner.run(actor, "Restore permission", async (tx: Prisma.TransactionClient) => {
			const permission: Permission | null = await this.permissions.findDeletedById(permissionId, tx);
			if (permission === null) {
				throw new NotFoundError({ message: `Deleted permission ${permissionId} not found` });
			}
			await this.escalation.assertHoldsPermissionPairs(actor, [permission]);
			const restored: Permission = await this.permissions.restore(permissionId, tx);
			const affectedUserIds: string[] = await this.assignments.findAffectedUserIdsByPermission(permissionId, tx);
			return {
				kind: "changed",
				result: restored,
				audit: { action: "PERMISSION_RESTORED", permissionId, detail: `${restored.action}:${restored.resource}` },
				affectedUserIds,
			};
		});
	}

	// ── Direct user grants ───────────────────────────────────────────────

	/**
	 * Grant a direct ALLOW, or set a DENY override, for another user. Either
	 * way the actor must hold the permission: an ALLOW hands it out, and a DENY
	 * strips it — a lesser administrator can do neither for powers beyond its own.
	 */
	public async giveToUser(actor: AuthorizationActor, input: GrantPermissionToUserInput): Promise<UserPermission> {
		return this.runner.run(actor, "Grant direct permission", async (tx: Prisma.TransactionClient) => {
			await this.escalation.requireManageableUser(actor, input.userId, tx);
			if ((await this.permissions.findById(input.permissionId, tx)) === null) {
				throw new NotFoundError({ message: `Permission ${input.permissionId} not found` });
			}
			await this.escalation.assertCanGrantPermissions(actor, [input.permissionId], tx);
			const grant: UserPermission = await this.assignments.givePermissionToUser({ ...input, assignedBy: actor.id }, tx);
			return {
				kind: "changed",
				result: grant,
				audit: {
					action: "PERMISSION_GRANTED",
					targetUserId: input.userId,
					permissionId: input.permissionId,
					detail: JSON.stringify({ effect: input.effect, expiresAt: input.expiresAt ?? null }),
				},
				affectedUserIds: [input.userId],
			};
		});
	}

	/** Remove a direct grant or DENY override. Lifting a DENY is as privileged as granting. */
	public async revokeFromUser(actor: AuthorizationActor, userId: string, permissionId: string): Promise<void> {
		await this.runner.run(actor, "Revoke direct permission", async (tx: Prisma.TransactionClient) => {
			await this.escalation.requireManageableUser(actor, userId, tx);
			await this.escalation.assertCanGrantPermissions(actor, [permissionId], tx);
			if (!(await this.assignments.revokePermissionFromUser(userId, permissionId, tx))) {
				throw new NotFoundError({ message: `User ${userId} has no direct override for permission ${permissionId}` });
			}
			return { kind: "changed", result: undefined, audit: { action: "PERMISSION_REVOKED", targetUserId: userId, permissionId }, affectedUserIds: [userId] };
		});
	}

	/**
	 * Replace another user's direct ALLOW grants. DENY overrides are left
	 * untouched, and listing a permission the user holds a DENY for is rejected
	 * (lift the DENY with an explicit revoke). Every added and every removed
	 * grant must be within the actor's reach.
	 */
	public async syncUserPermissions(actor: AuthorizationActor, userId: string, permissionIds: readonly string[]): Promise<void> {
		const desired: string[] = [...new Set<string>(permissionIds)];
		await this.runner.run(actor, "Sync direct permissions", async (tx: Prisma.TransactionClient) => {
			await this.escalation.requireManageableUser(actor, userId, tx);
			if ((await this.permissions.countExisting(desired, tx)) !== desired.length) {
				throw new NotFoundError({ message: "One or more permissions were not found" });
			}
			await this.conflicts.assertNoAllowDenyConflict(userId, desired, tx);
			const overrides = await this.assignments.findDirectOverrides(userId, tx);
			const removed: string[] = overrides
				.filter((override): boolean => override.effect === "ALLOW" && !desired.includes(override.permissionId))
				.map((override): string => override.permissionId);
			await this.escalation.assertCanGrantPermissions(actor, [...desired, ...removed], tx);
			await this.assignments.syncUserAllowGrants(userId, desired, actor.id, tx);
			return {
				kind: "changed",
				result: undefined,
				audit: { action: "USER_PERMISSIONS_SYNCED", targetUserId: userId, detail: JSON.stringify({ permissionIds: desired }) },
				affectedUserIds: [userId],
			};
		});
	}

	// ── Helpers ──────────────────────────────────────────────────────────

	private async requireMutablePermission(permissionId: string, db: Prisma.TransactionClient): Promise<Permission> {
		const permission: Permission | null = await this.permissions.findById(permissionId, db);
		if (permission === null) {
			throw new NotFoundError({ message: `Permission ${permissionId} not found` });
		}
		if (permission.isSystem) {
			throw new AuthorizationError({ message: `${permission.action}:${permission.resource} is a system permission and cannot be modified` });
		}
		return permission;
	}
}

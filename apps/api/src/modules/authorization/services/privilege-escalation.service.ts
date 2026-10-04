import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { PermissionPair } from "@workspace/shared";

import { NotFoundError } from "../../../common/errors/app-error";
import { AuthorizationException } from "../exceptions/authorization.exception";
import { AuthorizationKernelService } from "../kernel/authorization-kernel.service";
import { PermissionRepository } from "../repositories/permission.repository";
import { RoleAssignmentRepository, type RbacTargetUser } from "../repositories/role-assignment.repository";
import { RoleRepository } from "../repositories/role.repository";

/** The authenticated administrator performing an authorization-management change. */
export interface AuthorizationActor {
	readonly id: string;
	readonly isSuperAdmin: boolean;
}

/**
 * Privilege-escalation guard for authorization administration (spec §68, §69).
 *
 * Rules (platform SuperAdmins are exempt — they already hold everything):
 * 1. **No self-escalation** — an actor cannot change their own role
 *    assignments or direct permissions, nor edit a role they currently hold
 *    (directly or through the hierarchy).
 * 2. **Subset rule** — an actor can only grant, assign, restore, remove, or
 *    make inheritable permissions they themselves currently hold with GLOBAL
 *    reach. Removal counts: a lesser administrator cannot strip a role or
 *    grant it could not have handed out.
 * 3. **SuperAdmin accounts** — only a SuperAdmin changes a SuperAdmin's RBAC state.
 *
 * Role hierarchies are walked through **every** ancestor regardless of its
 * deleted / active state: a restore or re-activation can bring any of them
 * back into effect, so all of them must already be within the actor's reach.
 *
 * Every check reads through the mutation's transaction (`db`), which holds the
 * RBAC advisory lock, so no concurrent RBAC write can change the state between
 * the check and the write.
 */
@Injectable()
export class PrivilegeEscalationService {
	public constructor(
		private readonly kernel: AuthorizationKernelService,
		private readonly roles: RoleRepository,
		private readonly permissions: PermissionRepository,
		private readonly assignments: RoleAssignmentRepository,
	) {}

	/** Reject changes to the actor's own assignments. */
	public assertNotSelf(actor: AuthorizationActor, targetUserId: string): void {
		if (!actor.isSuperAdmin && actor.id === targetUserId) {
			throw new AuthorizationException();
		}
	}

	/**
	 * The target of a user-level RBAC change: not the actor, an existing
	 * account, and not a SuperAdmin unless the actor is one.
	 *
	 * @throws AuthorizationException / NotFoundError
	 */
	public async requireManageableUser(actor: AuthorizationActor, userId: string, db: Prisma.TransactionClient): Promise<RbacTargetUser> {
		this.assertNotSelf(actor, userId);
		const target: RbacTargetUser | null = await this.assignments.findTargetUser(userId, db);
		if (target === null) {
			throw new NotFoundError({ message: `User ${userId} not found` });
		}
		this.assertCanManageUser(actor, target);
		return target;
	}

	/** Reject a non-SuperAdmin changing a SuperAdmin account's roles or grants. */
	public assertCanManageUser(actor: AuthorizationActor, target: { readonly isSuperAdmin: boolean }): void {
		if (!actor.isSuperAdmin && target.isSuperAdmin) {
			throw new AuthorizationException();
		}
	}

	/** Reject edits to a role the actor holds (directly or via inheritance, whatever the role's state). */
	public async assertNotHoldingRole(actor: AuthorizationActor, roleId: string, db: Prisma.TransactionClient): Promise<void> {
		if (actor.isSuperAdmin) {
			return;
		}
		const assigned: string[] = await this.assignments.findAssignedRoleIds(actor.id, db);
		const held: string[] = await this.withAllAncestors(assigned, db);
		if (held.includes(roleId)) {
			throw new AuthorizationException();
		}
	}

	/** Every permission in `permissionIds` must already be held by the actor. */
	public async assertCanGrantPermissions(actor: AuthorizationActor, permissionIds: readonly string[], db: Prisma.TransactionClient): Promise<void> {
		if (actor.isSuperAdmin || permissionIds.length === 0) {
			return;
		}
		const permissions = await this.permissions.findKeysByIds(permissionIds, db);
		await this.assertHoldsAll(actor, permissions);
	}

	/** Every `ACTION:RESOURCE` pair must already be held by the actor (for rows the id lookup cannot see, e.g. a deleted permission being restored). */
	public async assertHoldsPermissionPairs(actor: AuthorizationActor, pairs: readonly PermissionPair[]): Promise<void> {
		if (actor.isSuperAdmin || pairs.length === 0) {
			return;
		}
		await this.assertHoldsAll(actor, pairs);
	}

	/** Every permission the roles confer — their own and every ancestor's — must already be held by the actor. */
	public async assertCanGrantRoles(actor: AuthorizationActor, roleIds: readonly string[], db: Prisma.TransactionClient): Promise<void> {
		if (actor.isSuperAdmin || roleIds.length === 0) {
			return;
		}
		const lineage: string[] = await this.withAllAncestors(roleIds, db);
		const conferred = await this.assignments.findRolePermissionKeys(lineage, db);
		await this.assertHoldsAll(actor, conferred);
	}

	private async assertHoldsAll(actor: AuthorizationActor, required: readonly PermissionPair[]): Promise<void> {
		const unique = new Map<string, PermissionPair>();
		for (const pair of required) {
			unique.set(`${pair.action}:${pair.resource}`, pair);
		}
		for (const pair of unique.values()) {
			// No tenant, no resource: only GLOBAL grants count as "holding" a permission.
			const decision = await this.kernel.can({ subject: { userId: actor.id, isSuperAdmin: false }, action: pair.action, resource: pair.resource });
			if (decision !== "ALLOW") {
				throw new AuthorizationException();
			}
		}
	}

	/** `roleIds` plus every ancestor, following parent links through deleted and inactive roles alike. */
	private async withAllAncestors(roleIds: readonly string[], db: Prisma.TransactionClient): Promise<string[]> {
		const collected = new Set<string>();
		let frontier: string[] = [...new Set<string>(roleIds)];
		while (frontier.length > 0) {
			for (const id of frontier) {
				collected.add(id);
			}
			const links = await this.roles.findParentLinks(frontier, db);
			frontier = links.flatMap((link): string[] => (link.parentId !== null && !collected.has(link.parentId) ? [link.parentId] : []));
		}
		return Array.from(collected);
	}
}

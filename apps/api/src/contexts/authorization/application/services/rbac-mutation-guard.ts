import { Inject, Injectable } from "@nestjs/common";

import type { RoleAggregate } from "../../domain/aggregates/role.aggregate";
import type { UserAuthorizationAggregate } from "../../domain/aggregates/user-authorization.aggregate";
import { RbacTargetUserNotFoundError, RoleNotFoundError } from "../../domain/errors/authorization.errors";
import { assertProtectedRolesKeepAHolder } from "../../domain/policies/protected-role-holder.policy";
import {
	assertCanManageAccount,
	assertHoldsEveryPermission,
	assertNotHoldingRole,
	assertNotSelf,
	distinctPermissionPairs,
	needsReachCheck,
	type RbacActor,
	type RbacPermissionPair,
} from "../../domain/policies/rbac-escalation.policy";
import { assertSeparationOfDuties } from "../../domain/policies/separation-of-duties.policy";
import { LAST_HOLDER_PROTECTED_ROLE_NAMES } from "../../domain/rbac-catalog";
import type { AuthorizationScope } from "../authorization-scope";
import { PERMISSION_REACH } from "../ports/authorization.tokens";
import type { PermissionReachPort } from "../ports/permission-reach.port";

/**
 * Loads what the RBAC domain policies need (role lineage, conferred permissions, holders) through the
 * mutation's transaction, which holds the RBAC advisory lock, then applies the pure policies in
 * `domain/policies`. Every check therefore reads state no concurrent RBAC write can change before commit.
 */
@Injectable()
export class RbacMutationGuard {
	public constructor(@Inject(PERMISSION_REACH) private readonly reach: PermissionReachPort) {}

	/**
	 * The target of a user-level change: not the actor, an existing account, and not a SuperAdmin unless
	 * the actor is one. @throws AccessDeniedError / RbacTargetUserNotFoundError
	 */
	public async requireManageableAccount(scope: AuthorizationScope, actor: RbacActor, userId: string): Promise<UserAuthorizationAggregate> {
		assertNotSelf(actor, userId);
		const target: UserAuthorizationAggregate | null = await scope.userAuthorizations.findForAccount(userId);
		if (target === null) {
			throw new RbacTargetUserNotFoundError(userId);
		}
		assertCanManageAccount(actor, target.account);
		return target;
	}

	/** @throws RoleNotFoundError when no live role has that id. */
	public async requireLiveRole(scope: AuthorizationScope, roleId: string): Promise<RoleAggregate> {
		const role: RoleAggregate | null = await scope.roles.findLive(roleId);
		if (role === null) {
			throw new RoleNotFoundError(roleId);
		}
		return role;
	}

	/**
	 * A live, non-system role the actor neither holds nor lacks the reach for (role-level edits change its
	 * holders' permissions). The system check comes first, as the API always answered it.
	 */
	public async requireMutableRole(scope: AuthorizationScope, actor: RbacActor, roleId: string): Promise<RoleAggregate> {
		const role: RoleAggregate = await this.requireLiveRole(scope, roleId);
		role.assertMutable();
		await this.assertNotHoldingRole(scope, actor, roleId);
		await this.assertCanGrantRoles(scope, actor, [roleId]);
		return role;
	}

	/** Reject edits to a role the actor holds, directly or by inheritance, whatever the role's state. */
	public async assertNotHoldingRole(scope: AuthorizationScope, actor: RbacActor, roleId: string): Promise<void> {
		if (!needsReachCheck(actor)) {
			return;
		}
		const held: ReadonlySet<string> = await scope.rbacGraph.withAllAncestors(await scope.rbacGraph.assignedRoleIds(actor.userId));
		assertNotHoldingRole(actor, held, roleId);
	}

	/** Every permission in `permissionIds` must already be held by the actor. */
	public async assertCanGrantPermissions(scope: AuthorizationScope, actor: RbacActor, permissionIds: readonly string[]): Promise<void> {
		if (!needsReachCheck(actor) || permissionIds.length === 0) {
			return;
		}
		await this.assertHoldsPairs(actor, await scope.permissions.findLivePairs(permissionIds));
	}

	/** Every `ACTION:RESOURCE` pair must already be held (for rows the id lookup cannot see, e.g. a deleted permission being restored). */
	public async assertHoldsPairs(actor: RbacActor, pairs: readonly RbacPermissionPair[]): Promise<void> {
		if (!needsReachCheck(actor) || pairs.length === 0) {
			return;
		}
		const required: RbacPermissionPair[] = distinctPermissionPairs(pairs);
		assertHoldsEveryPermission(actor, required, await this.reach.heldGlobally(actor.userId, required));
	}

	/** Every permission the roles confer (their own and every ancestor's, deleted and inactive ones included) must already be held. */
	public async assertCanGrantRoles(scope: AuthorizationScope, actor: RbacActor, roleIds: readonly string[]): Promise<void> {
		if (!needsReachCheck(actor) || roleIds.length === 0) {
			return;
		}
		const lineage: ReadonlySet<string> = await scope.rbacGraph.withAllAncestors(roleIds);
		await this.assertHoldsPairs(actor, await scope.rbacGraph.permissionPairsConferredBy([...lineage]));
	}

	/** Post-write check: every user in `userIds` holds a conflict-free effective role set. */
	public async assertUsersHaveNoConflicts(scope: AuthorizationScope, userIds: readonly string[]): Promise<void> {
		for (const userId of new Set<string>(userIds)) {
			assertSeparationOfDuties(await scope.rbacGraph.effectiveRoleNames(await scope.rbacGraph.assignedRoleIds(userId)));
		}
	}

	/** Post-write check: every protected system role among `removedRoleIds` still has an active holder. */
	public async assertProtectedRolesKeepAHolder(scope: AuthorizationScope, removedRoleIds: readonly string[]): Promise<void> {
		if (removedRoleIds.length === 0) {
			return;
		}
		assertProtectedRolesKeepAHolder(removedRoleIds, await scope.rbacGraph.protectedRoleHolders(LAST_HOLDER_PROTECTED_ROLE_NAMES));
	}
}

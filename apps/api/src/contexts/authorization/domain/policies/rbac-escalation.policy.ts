import { AccessDeniedError } from "../errors/authorization.errors";
import { permissionKeyOf } from "../rbac-catalog";

/** The authenticated administrator performing an authorization-management change. */
export interface RbacActor {
	readonly userId: string;
	readonly isSuperAdmin: boolean;
}

/** The account a user-level RBAC change targets. */
export interface RbacTargetAccount {
	readonly userId: string;
	readonly isSuperAdmin: boolean;
}

/** An `ACTION:RESOURCE` pair a change hands out or takes away. */
export interface RbacPermissionPair {
	readonly action: string;
	readonly resource: string;
}

/**
 * Privilege-escalation rules for authorization administration (spec §68, §69). Platform SuperAdmins are
 * exempt: they already hold everything.
 *
 * 1. **No self-escalation.** An actor cannot change their own role assignments or direct permissions,
 *    nor edit a role they currently hold (directly or through the hierarchy).
 * 2. **Subset rule.** An actor can only grant, assign, restore, remove, or make inheritable permissions
 *    they themselves hold with GLOBAL reach. Removal counts: a lesser administrator cannot strip a role
 *    or a grant it could not have handed out.
 * 3. **SuperAdmin accounts.** Only a SuperAdmin changes a SuperAdmin's RBAC state.
 *
 * Every refusal is the same `PERMISSION_DENIED`: the response never says which rule failed.
 */
export function needsReachCheck(actor: RbacActor): boolean {
	return !actor.isSuperAdmin;
}

/** Rule 1: an actor never changes its own assignments. */
export function assertNotSelf(actor: RbacActor, targetUserId: string): void {
	if (needsReachCheck(actor) && actor.userId === targetUserId) {
		throw new AccessDeniedError();
	}
}

/** Rule 3: a non-SuperAdmin never changes a SuperAdmin account. */
export function assertCanManageAccount(actor: RbacActor, target: RbacTargetAccount): void {
	if (needsReachCheck(actor) && target.isSuperAdmin) {
		throw new AccessDeniedError();
	}
}

/**
 * Rule 1 for role edits: `heldRoleLineage` is every role the actor holds directly plus every ancestor,
 * walked through deleted and inactive roles alike (a restore or re-activation can bring any of them back).
 */
export function assertNotHoldingRole(actor: RbacActor, heldRoleLineage: ReadonlySet<string>, roleId: string): void {
	if (needsReachCheck(actor) && heldRoleLineage.has(roleId)) {
		throw new AccessDeniedError();
	}
}

/** The distinct pairs of `required`, keyed `ACTION:RESOURCE` (the reach check asks the kernel once per pair). */
export function distinctPermissionPairs(required: readonly RbacPermissionPair[]): RbacPermissionPair[] {
	const unique = new Map<string, RbacPermissionPair>();
	for (const pair of required) {
		unique.set(permissionKeyOf(pair), pair);
	}
	return [...unique.values()];
}

/**
 * Rule 2: every pair in `required` must be in `heldGlobally` (the `ACTION:RESOURCE` keys the actor holds
 * with GLOBAL reach — no tenant, no resource).
 */
export function assertHoldsEveryPermission(actor: RbacActor, required: readonly RbacPermissionPair[], heldGlobally: ReadonlySet<string>): void {
	if (!needsReachCheck(actor)) {
		return;
	}
	for (const pair of required) {
		if (!heldGlobally.has(permissionKeyOf(pair))) {
			throw new AccessDeniedError();
		}
	}
}

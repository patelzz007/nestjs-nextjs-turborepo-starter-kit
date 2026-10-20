import type { RbacPermissionPair } from "../../domain/policies/rbac-escalation.policy";

/**
 * The escalation subset rule's input: which of `pairs` the actor holds with GLOBAL reach (no tenant, no
 * resource), decided by the authorization kernel. Returns `ACTION:RESOURCE` keys.
 */
export interface PermissionReachPort {
	heldGlobally(actorUserId: string, pairs: readonly RbacPermissionPair[]): Promise<ReadonlySet<string>>;
}

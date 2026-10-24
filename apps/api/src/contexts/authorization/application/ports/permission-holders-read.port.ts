import type { PermissionAction, PermissionResource } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";

/**
 * Who holds a platform permission, as another context asks it ("who may be assigned a kanban
 * item?"). Mirrors the kernel's grant resolution for an unconditional global grant: live, active
 * roles (a child role inherits its ancestors' grants) held directly or as a location role, live
 * unexpired direct ALLOW overrides, minus live unexpired DENY overrides, plus every SuperAdmin —
 * active, live accounts only. `MANAGE` implies every action. ABAC conditions are not evaluated:
 * a context that needs a per-request decision asks `AuthorizationPort` instead.
 */
export interface PermissionHoldersReadPort {
	holdersOf(actor: ActorContext, action: PermissionAction, resource: PermissionResource): Promise<readonly string[]>;
}

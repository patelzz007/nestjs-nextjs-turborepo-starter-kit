import { Inject, Injectable } from "@nestjs/common";
import { PermissionActionSchema, PermissionResourceSchema } from "@workspace/shared";

import { AUTHORIZATION_KERNEL } from "../../application/ports/authorization.tokens";
import type { AuthorizationKernelPort } from "../../application/ports/authorization-kernel.port";
import type { PermissionReachPort } from "../../application/ports/permission-reach.port";
import type { RbacPermissionPair } from "../../domain/policies/rbac-escalation.policy";
import { permissionKeyOf } from "../../domain/rbac-catalog";

/** No tenant, no resource: only GLOBAL grants count as "holding" a permission for the escalation subset rule. */
@Injectable()
export class PermissionReachAdapter implements PermissionReachPort {
	public constructor(@Inject(AUTHORIZATION_KERNEL) private readonly kernel: AuthorizationKernelPort) {}

	public async heldGlobally(actorUserId: string, pairs: readonly RbacPermissionPair[]): Promise<ReadonlySet<string>> {
		const held = new Set<string>();
		for (const pair of pairs) {
			const action = PermissionActionSchema.safeParse(pair.action);
			const resource = PermissionResourceSchema.safeParse(pair.resource);
			if (!action.success || !resource.success) {
				continue;
			}
			const decision = await this.kernel.can({ subject: { userId: actorUserId, isSuperAdmin: false }, action: action.data, resource: resource.data });
			if (decision === "ALLOW") {
				held.add(permissionKeyOf(pair));
			}
		}
		return held;
	}
}

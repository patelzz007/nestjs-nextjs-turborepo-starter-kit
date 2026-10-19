import { Inject, Injectable } from "@nestjs/common";
import { PermissionActionSchema, PermissionResourceSchema, type AuthorizationRequest } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { AuthorizationCheck, AuthorizationPort } from "../../../../platform/application/ports/authorization.port";
import { AuthorizationDeniedError } from "../../../../platform/domain/errors/authorization-denied.error";
import { AUTHORIZATION_KERNEL } from "../../application/ports/authorization.tokens";
import type { AuthorizationKernelPort } from "../../application/ports/authorization-kernel.port";

/**
 * Resource-level authorization for handlers (§5.9), over the kernel. Only an authenticated user is a
 * kernel subject; an API key or anonymous actor is denied (API keys are authorized by their scopes).
 */
@Injectable()
export class AuthorizationPortAdapter implements AuthorizationPort {
	public constructor(@Inject(AUTHORIZATION_KERNEL) private readonly kernel: AuthorizationKernelPort) {}

	public async can(actor: ActorContext, check: AuthorizationCheck): Promise<boolean> {
		const request: AuthorizationRequest | null = requestFor(actor, check);
		return request !== null && (await this.kernel.can(request)) === "ALLOW";
	}

	public async assertAllowed(actor: ActorContext, check: AuthorizationCheck): Promise<void> {
		if (!(await this.can(actor, check))) {
			throw new AuthorizationDeniedError(check.action, check.resource);
		}
	}
}

function requestFor(actor: ActorContext, check: AuthorizationCheck): AuthorizationRequest | null {
	const action = PermissionActionSchema.safeParse(check.action);
	const resource = PermissionResourceSchema.safeParse(check.resource);
	if (actor.kind !== "user" || !action.success || !resource.success) {
		return null;
	}
	return {
		subject: { userId: actor.userId, isSuperAdmin: actor.isSuperAdmin, ...(actor.organizationId === null ? {} : { organizationId: actor.organizationId }) },
		action: action.data,
		resource: resource.data,
		...(check.resourceId === null ? {} : { resourceId: check.resourceId }),
	};
}

import { systemActor, type ActorContext, type SystemOrigin } from "../../../../platform/application/actor-context";
import type { SystemOperationName } from "../../../../platform/application/system-operation-names";
import { AccessDeniedError } from "../../domain/errors/authorization.errors";
import type { RbacActor } from "../../domain/policies/rbac-escalation.policy";
import type { SystemActor, UserActor } from "./rbac-mutation-scope";

/** Only an authenticated user manages RBAC; an API key or anonymous caller never does. */
export function requireUserActor(actor: ActorContext): UserActor {
	if (actor.kind !== "user") {
		throw new AccessDeniedError();
	}
	return actor;
}

/** The administrator as the escalation policy sees it. */
export function rbacActorOf(actor: UserActor): RbacActor {
	return { userId: actor.userId, isSuperAdmin: actor.isSuperAdmin };
}

/** A job / bootstrap actor for one of this context's allowlisted system operations. */
export function authorizationSystemActor(operation: SystemOperationName, origin: SystemOrigin, reason: string): SystemActor {
	const actor: ActorContext = systemActor(operation, origin, null, reason, null);
	if (actor.kind !== "system") {
		throw new AccessDeniedError();
	}
	return actor;
}

import type { ActorContext } from "../../../platform/application/actor-context";
import { AuthenticationError, NotFoundError } from "../../../platform/application/errors/app-error";

/** The signed-in user a tenant route acts for. */
export type UserActor = Extract<ActorContext, { kind: "user" }>;

/** Tenant member routes are user routes: any other principal is unauthenticated here. */
export function requireUserActor(actor: ActorContext): UserActor {
	if (actor.kind !== "user") {
		throw new AuthenticationError({ message: "A signed-in user is required." });
	}
	return actor;
}

/** Shared with pos: the actor re-bound to the tenant its membership was verified for. */
export { actingInTenant } from "../../../platform/application/actor-context";

/** The user id written as the actor of an audit row; only users act on these routes. */
export function auditActorId(actor: ActorContext): string {
	return requireUserActor(actor).userId;
}

/** Uniform 404 for a resource that is missing, deleted, or not visible to the caller (no existence oracle). Same body Nest's `NotFoundException()` produced. */
export function notFound(): NotFoundError {
	return new NotFoundError({ message: "Not Found" });
}

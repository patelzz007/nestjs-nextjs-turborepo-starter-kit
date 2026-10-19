import type { ActorContext } from "../../../../platform/application/actor-context";
import { AuthenticationError } from "../../../../platform/application/errors/app-error";

/** The human behind the request, recorded on system reads made on their behalf; `null` for machine callers. */
export function actorUserIdOf(actor: ActorContext): string | null {
	if (actor.kind === "user") {
		return actor.userId;
	}
	if (actor.kind === "system") {
		return actor.actorUserId;
	}
	return null;
}

/** A customer's own analytics: only a signed-in user has any (the user id is never client input). */
export function requireCustomer(actor: ActorContext): string {
	if (actor.kind !== "user") {
		throw new AuthenticationError({ message: "Customer analytics need a signed-in user." });
	}
	return actor.userId;
}

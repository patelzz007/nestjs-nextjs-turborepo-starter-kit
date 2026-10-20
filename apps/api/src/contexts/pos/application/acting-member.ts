import type { ActorContext } from "../../../platform/application/actor-context";
import { AuthenticationError } from "../../../platform/application/errors/app-error";

/** The signed-in tenant member behind a console command (terminals and keys are managed by people, never by keys). */
export function actingMemberId(actor: ActorContext): string {
	if (actor.kind !== "user") {
		throw new AuthenticationError({ message: "A signed-in user is required for this action." });
	}
	return actor.userId;
}

/** Shared with tenants: the actor re-bound to the tenant its capability was verified for. */
export { actingInTenant } from "../../../platform/application/actor-context";

import type { ActorContext } from "../../../platform/application/actor-context";
import { AuthenticationError } from "../../../platform/application/errors/app-error";

/** The signed-in referrer behind a referrals query (a referrer only ever sees their own referrals). */
export function actingUserId(actor: ActorContext): string {
	if (actor.kind !== "user") {
		throw new AuthenticationError({ message: "A signed-in user is required for this action." });
	}
	return actor.userId;
}

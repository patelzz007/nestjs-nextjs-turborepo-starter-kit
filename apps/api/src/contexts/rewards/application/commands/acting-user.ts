import type { ActorContext } from "../../../../platform/application/actor-context";
import { AuthenticationError } from "../../../../platform/application/errors/app-error";

/** The signed-in person behind a command that only people may issue (reviews, legal acceptance). */
export function actingUserId(actor: ActorContext): string {
	if (actor.kind !== "user") {
		throw new AuthenticationError({ message: "A signed-in user is required for this action." });
	}
	return actor.userId;
}

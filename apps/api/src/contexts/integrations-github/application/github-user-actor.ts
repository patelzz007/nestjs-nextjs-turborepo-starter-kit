import type { ActorContext } from "../../../platform/application/actor-context";
import { AuthenticationError } from "../../../platform/application/errors/app-error";

/**
 * The signed-in user an admin GitHub request acts for. Every GitHub route but
 * the webhook needs a user session (the token is each admin's own), so any
 * other actor is refused rather than guessed.
 */
export function githubUserIdOf(actor: ActorContext): string {
	if (actor.kind !== "user") {
		throw new AuthenticationError({ message: "GitHub pull requests need a signed-in user." });
	}
	return actor.userId;
}

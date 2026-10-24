import type { ActorContext } from "../../../platform/application/actor-context";
import { AuthenticationError } from "../../../platform/application/errors/app-error";

/** The signed-in staff member behind a board change: tasks, comments and attachments are always someone's. */
export function actingStaffUserId(actor: ActorContext): string {
	if (actor.kind !== "user") {
		throw new AuthenticationError({ message: "A signed-in user is required for this action." });
	}
	return actor.userId;
}

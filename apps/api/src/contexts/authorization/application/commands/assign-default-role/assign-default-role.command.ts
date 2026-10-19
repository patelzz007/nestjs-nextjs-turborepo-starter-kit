import { Command } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/**
 * Attach the default consumer role to an existing self-provisioned account, in its own RBAC transaction.
 * `actor` is the request's own actor (signup and onboarding are anonymous requests); the account is the
 * audited actor of the assignment.
 */
export class AssignDefaultRoleCommand extends Command<void> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly userId: string,
	) {
		super();
	}
}

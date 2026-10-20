import { Command } from "@nestjs/cqrs";
import type { GithubAccountStatus, LinkGithubAccountInput } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** Checks the token with GitHub (who it belongs to, when it expires), then stores it encrypted — replacing any earlier token of the caller. */
export class LinkGithubAccountCommand extends Command<GithubAccountStatus> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: LinkGithubAccountInput,
	) {
		super();
	}
}

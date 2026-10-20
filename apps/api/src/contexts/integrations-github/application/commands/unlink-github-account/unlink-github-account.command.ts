import { Command } from "@nestjs/cqrs";
import type { GithubAccountStatus } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** Forgets the caller's token: the row is soft-deleted and the token wiped. */
export class UnlinkGithubAccountCommand extends Command<GithubAccountStatus> {
	public constructor(public readonly actor: ActorContext) {
		super();
	}
}

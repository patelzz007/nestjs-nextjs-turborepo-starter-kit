import { Command } from "@nestjs/cqrs";
import type { GithubLiveUpdatesParams, GithubLiveUpdatesStatus } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** Registers the repository's webhook with the caller's token. Already on is left as it is. Two admins turning it on at once: GitHub keeps one hook per address and the database one row per repository (ON CONFLICT claim), so both end up on the one; the loser deletes its own hook. */
export class EnableLiveUpdatesCommand extends Command<GithubLiveUpdatesStatus> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: GithubLiveUpdatesParams,
	) {
		super();
	}
}

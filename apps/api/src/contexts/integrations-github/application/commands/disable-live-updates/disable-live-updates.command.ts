import { Command } from "@nestjs/cqrs";
import type { GithubLiveUpdatesParams, GithubLiveUpdatesStatus } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** Deletes the repository's webhook with the caller's token, then turns the row off (compare-and-set on the hook it deleted). Already off is left as it is. */
export class DisableLiveUpdatesCommand extends Command<GithubLiveUpdatesStatus> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: GithubLiveUpdatesParams,
	) {
		super();
	}
}

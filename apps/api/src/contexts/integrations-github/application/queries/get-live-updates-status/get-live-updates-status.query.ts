import { Query } from "@nestjs/cqrs";
import type { GithubLiveUpdatesParams, GithubLiveUpdatesStatus } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** Whether a repository's pull requests update live. */
export class GetLiveUpdatesStatusQuery extends Query<GithubLiveUpdatesStatus> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: GithubLiveUpdatesParams,
	) {
		super();
	}
}

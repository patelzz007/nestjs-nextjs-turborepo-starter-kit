import { Query } from "@nestjs/cqrs";
import type { GithubLiveUpdatesParams } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** Refuses (404, as GitHub answers) a stream of a repository the caller's own token cannot see; 503 when live updates are off. */
export class CheckLiveUpdatesStreamQuery extends Query<void> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: GithubLiveUpdatesParams,
	) {
		super();
	}
}

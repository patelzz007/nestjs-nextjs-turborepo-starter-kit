import { Query } from "@nestjs/cqrs";
import type { GithubPullRequestParams, GithubTimelinePage } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** The pull request and the cursor of the page after the one shown (`undefined`: the first). */
export interface GetPullRequestTimelineInput {
	readonly params: GithubPullRequestParams;
	readonly cursor: string | undefined;
}

/** A later page of a pull request's conversation. */
export class GetPullRequestTimelineQuery extends Query<GithubTimelinePage> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: GetPullRequestTimelineInput,
	) {
		super();
	}
}

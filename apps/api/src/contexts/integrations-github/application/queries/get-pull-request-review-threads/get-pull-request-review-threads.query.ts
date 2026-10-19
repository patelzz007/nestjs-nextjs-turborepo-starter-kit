import { Query } from "@nestjs/cqrs";
import type { GithubPullRequestParams, GithubReviewThreadList } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** The conversations on lines of a pull request's diff. */
export class GetPullRequestReviewThreadsQuery extends Query<GithubReviewThreadList> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: GithubPullRequestParams,
	) {
		super();
	}
}

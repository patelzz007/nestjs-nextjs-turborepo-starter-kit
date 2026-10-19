import { Query } from "@nestjs/cqrs";
import type { GithubPullRequestParams, GithubPullRequestStatus } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** A pull request's merge box: checks and conflicts. */
export class GetPullRequestStatusQuery extends Query<GithubPullRequestStatus> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: GithubPullRequestParams,
	) {
		super();
	}
}

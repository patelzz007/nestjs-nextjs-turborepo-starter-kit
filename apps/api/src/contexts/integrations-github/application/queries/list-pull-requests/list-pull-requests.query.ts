import { Query } from "@nestjs/cqrs";
import type { GithubPullRequestListQuery, GithubPullRequestPage } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** One page of the caller's pull requests, searched with their own token. */
export class ListPullRequestsQuery extends Query<GithubPullRequestPage> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: GithubPullRequestListQuery,
	) {
		super();
	}
}

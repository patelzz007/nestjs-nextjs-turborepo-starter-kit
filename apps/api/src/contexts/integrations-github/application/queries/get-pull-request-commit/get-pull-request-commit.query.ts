import { Query } from "@nestjs/cqrs";
import type { GithubCommitDetail, GithubPullRequestCommitParams } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** One of a pull request's commits with its diff. */
export class GetPullRequestCommitQuery extends Query<GithubCommitDetail> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: GithubPullRequestCommitParams,
	) {
		super();
	}
}

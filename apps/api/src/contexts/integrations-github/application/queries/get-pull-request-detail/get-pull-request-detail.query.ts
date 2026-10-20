import { Query } from "@nestjs/cqrs";
import type { GithubPullRequestDetail, GithubPullRequestParams } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** One pull request with the first page of its conversation. */
export class GetPullRequestDetailQuery extends Query<GithubPullRequestDetail> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: GithubPullRequestParams,
	) {
		super();
	}
}

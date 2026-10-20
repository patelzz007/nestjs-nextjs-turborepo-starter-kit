import { Query } from "@nestjs/cqrs";
import type { GithubPullRequestCommitPage, GithubPullRequestParams } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** The pull request and the cursor of the page after the one shown (`undefined`: the first). */
export interface GetPullRequestCommitsInput {
	readonly params: GithubPullRequestParams;
	readonly cursor: string | undefined;
}

/** A pull request's commits, oldest first. */
export class GetPullRequestCommitsQuery extends Query<GithubPullRequestCommitPage> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: GetPullRequestCommitsInput,
	) {
		super();
	}
}

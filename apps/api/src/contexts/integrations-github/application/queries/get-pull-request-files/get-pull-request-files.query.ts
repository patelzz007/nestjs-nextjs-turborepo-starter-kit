import { Query } from "@nestjs/cqrs";
import type { GithubPullRequestFilePage, GithubPullRequestParams } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** The pull request and the 1-based page of its files. */
export interface GetPullRequestFilesInput {
	readonly params: GithubPullRequestParams;
	readonly page: number;
}

/** One page of a pull request's changed files with their diffs. */
export class GetPullRequestFilesQuery extends Query<GithubPullRequestFilePage> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: GetPullRequestFilesInput,
	) {
		super();
	}
}

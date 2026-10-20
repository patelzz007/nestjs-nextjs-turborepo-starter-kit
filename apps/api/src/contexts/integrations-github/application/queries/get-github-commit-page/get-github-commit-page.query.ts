import { Query } from "@nestjs/cqrs";
import type { GithubCommitHistoryQuery, GithubCommitPage, GithubRepositoryParams } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** The repository and the page of its history. */
export interface GetGithubCommitPageInput {
	readonly params: GithubRepositoryParams;
	readonly query: GithubCommitHistoryQuery;
}

/** One page of a listed repository's default-branch history. */
export class GetGithubCommitPageQuery extends Query<GithubCommitPage> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: GetGithubCommitPageInput,
	) {
		super();
	}
}

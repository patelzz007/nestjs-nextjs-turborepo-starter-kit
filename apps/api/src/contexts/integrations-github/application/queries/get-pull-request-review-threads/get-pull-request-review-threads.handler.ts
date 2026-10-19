import { Inject, Injectable } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { GithubReviewThreadList } from "@workspace/shared";

import type { GithubPullRequestReadsPort } from "../../ports/github-pull-requests.port";
import { GITHUB_PULL_REQUEST_READS } from "../../ports/github.tokens";
import { githubUserIdOf } from "../../github-user-actor";
import { GithubLinkedCredentials } from "../../services/github-linked-credentials";
import { GetPullRequestReviewThreadsQuery } from "./get-pull-request-review-threads.query";

@Injectable()
@QueryHandler(GetPullRequestReviewThreadsQuery)
export class GetPullRequestReviewThreadsHandler implements IQueryHandler<GetPullRequestReviewThreadsQuery, GithubReviewThreadList> {
	public constructor(
		private readonly credentials: GithubLinkedCredentials,
		@Inject(GITHUB_PULL_REQUEST_READS) private readonly reads: GithubPullRequestReadsPort,
	) {}

	public execute(query: GetPullRequestReviewThreadsQuery): Promise<GithubReviewThreadList> {
		return this.credentials.withCredential(query.actor, (linked) => this.reads.reviewThreads(githubUserIdOf(query.actor), linked, query.input));
	}
}

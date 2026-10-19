import { Inject, Injectable } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { GithubPullRequestCommitPage } from "@workspace/shared";

import type { GithubPullRequestReadsPort } from "../../ports/github-pull-requests.port";
import { GITHUB_PULL_REQUEST_READS } from "../../ports/github.tokens";
import { githubUserIdOf } from "../../github-user-actor";
import { GithubLinkedCredentials } from "../../services/github-linked-credentials";
import { GetPullRequestCommitsQuery } from "./get-pull-request-commits.query";

@Injectable()
@QueryHandler(GetPullRequestCommitsQuery)
export class GetPullRequestCommitsHandler implements IQueryHandler<GetPullRequestCommitsQuery, GithubPullRequestCommitPage> {
	public constructor(
		private readonly credentials: GithubLinkedCredentials,
		@Inject(GITHUB_PULL_REQUEST_READS) private readonly reads: GithubPullRequestReadsPort,
	) {}

	public execute(query: GetPullRequestCommitsQuery): Promise<GithubPullRequestCommitPage> {
		return this.credentials.withCredential(query.actor, (linked) => this.reads.commits(githubUserIdOf(query.actor), linked, query.input.params, query.input.cursor));
	}
}

import { Inject, Injectable } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { GithubCommitDetail } from "@workspace/shared";

import type { GithubPullRequestReadsPort } from "../../ports/github-pull-requests.port";
import { GITHUB_PULL_REQUEST_READS } from "../../ports/github.tokens";
import { githubUserIdOf } from "../../github-user-actor";
import { GithubLinkedCredentials } from "../../services/github-linked-credentials";
import { GetPullRequestCommitQuery } from "./get-pull-request-commit.query";

@Injectable()
@QueryHandler(GetPullRequestCommitQuery)
export class GetPullRequestCommitHandler implements IQueryHandler<GetPullRequestCommitQuery, GithubCommitDetail> {
	public constructor(
		private readonly credentials: GithubLinkedCredentials,
		@Inject(GITHUB_PULL_REQUEST_READS) private readonly reads: GithubPullRequestReadsPort,
	) {}

	public execute(query: GetPullRequestCommitQuery): Promise<GithubCommitDetail> {
		return this.credentials.withCredential(query.actor, (linked) => this.reads.commit(githubUserIdOf(query.actor), linked, query.input));
	}
}

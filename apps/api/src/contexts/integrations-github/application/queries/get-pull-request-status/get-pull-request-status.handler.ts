import { Inject, Injectable } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { GithubPullRequestStatus } from "@workspace/shared";

import type { GithubPullRequestReadsPort } from "../../ports/github-pull-requests.port";
import { GITHUB_PULL_REQUEST_READS } from "../../ports/github.tokens";
import { githubUserIdOf } from "../../github-user-actor";
import { GithubLinkedCredentials } from "../../services/github-linked-credentials";
import { GetPullRequestStatusQuery } from "./get-pull-request-status.query";

@Injectable()
@QueryHandler(GetPullRequestStatusQuery)
export class GetPullRequestStatusHandler implements IQueryHandler<GetPullRequestStatusQuery, GithubPullRequestStatus> {
	public constructor(
		private readonly credentials: GithubLinkedCredentials,
		@Inject(GITHUB_PULL_REQUEST_READS) private readonly reads: GithubPullRequestReadsPort,
	) {}

	public execute(query: GetPullRequestStatusQuery): Promise<GithubPullRequestStatus> {
		return this.credentials.withCredential(query.actor, (linked) => this.reads.status(githubUserIdOf(query.actor), linked, query.input));
	}
}

import { Inject, Injectable } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { GithubPullRequestDetail } from "@workspace/shared";

import type { GithubPullRequestReadsPort } from "../../ports/github-pull-requests.port";
import { GITHUB_PULL_REQUEST_READS } from "../../ports/github.tokens";
import { githubUserIdOf } from "../../github-user-actor";
import { GithubLinkedCredentials } from "../../services/github-linked-credentials";
import { GetPullRequestDetailQuery } from "./get-pull-request-detail.query";

@Injectable()
@QueryHandler(GetPullRequestDetailQuery)
export class GetPullRequestDetailHandler implements IQueryHandler<GetPullRequestDetailQuery, GithubPullRequestDetail> {
	public constructor(
		private readonly credentials: GithubLinkedCredentials,
		@Inject(GITHUB_PULL_REQUEST_READS) private readonly reads: GithubPullRequestReadsPort,
	) {}

	public execute(query: GetPullRequestDetailQuery): Promise<GithubPullRequestDetail> {
		return this.credentials.withCredential(query.actor, (linked) => this.reads.detail(githubUserIdOf(query.actor), linked, query.input));
	}
}

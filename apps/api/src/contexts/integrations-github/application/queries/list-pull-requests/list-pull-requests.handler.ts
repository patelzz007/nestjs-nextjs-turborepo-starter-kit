import { Inject, Injectable } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { GithubPullRequestPage } from "@workspace/shared";

import type { GithubPullRequestReadsPort } from "../../ports/github-pull-requests.port";
import { GITHUB_PULL_REQUEST_READS } from "../../ports/github.tokens";
import { githubUserIdOf } from "../../github-user-actor";
import { GithubLinkedCredentials } from "../../services/github-linked-credentials";
import { ListPullRequestsQuery } from "./list-pull-requests.query";

@Injectable()
@QueryHandler(ListPullRequestsQuery)
export class ListPullRequestsHandler implements IQueryHandler<ListPullRequestsQuery, GithubPullRequestPage> {
	public constructor(
		private readonly credentials: GithubLinkedCredentials,
		@Inject(GITHUB_PULL_REQUEST_READS) private readonly reads: GithubPullRequestReadsPort,
	) {}

	public execute(query: ListPullRequestsQuery): Promise<GithubPullRequestPage> {
		return this.credentials.withCredential(query.actor, (linked) => this.reads.list(githubUserIdOf(query.actor), linked, query.input));
	}
}

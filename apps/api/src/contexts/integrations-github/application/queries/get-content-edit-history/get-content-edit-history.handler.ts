import { Inject, Injectable } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { GithubContentEditHistory } from "@workspace/shared";

import type { GithubPullRequestReadsPort } from "../../ports/github-pull-requests.port";
import { GITHUB_PULL_REQUEST_READS } from "../../ports/github.tokens";
import { githubUserIdOf } from "../../github-user-actor";
import { GithubLinkedCredentials } from "../../services/github-linked-credentials";
import { GetContentEditHistoryQuery } from "./get-content-edit-history.query";

@Injectable()
@QueryHandler(GetContentEditHistoryQuery)
export class GetContentEditHistoryHandler implements IQueryHandler<GetContentEditHistoryQuery, GithubContentEditHistory> {
	public constructor(
		private readonly credentials: GithubLinkedCredentials,
		@Inject(GITHUB_PULL_REQUEST_READS) private readonly reads: GithubPullRequestReadsPort,
	) {}

	public execute(query: GetContentEditHistoryQuery): Promise<GithubContentEditHistory> {
		return this.credentials.withCredential(query.actor, (linked) => this.reads.contentEdits(githubUserIdOf(query.actor), linked, query.input.nodeId));
	}
}

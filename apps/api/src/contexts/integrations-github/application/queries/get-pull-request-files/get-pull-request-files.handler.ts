import { Inject, Injectable } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { GithubPullRequestFilePage } from "@workspace/shared";

import type { GithubPullRequestReadsPort } from "../../ports/github-pull-requests.port";
import { GITHUB_PULL_REQUEST_READS } from "../../ports/github.tokens";
import { githubUserIdOf } from "../../github-user-actor";
import { GithubLinkedCredentials } from "../../services/github-linked-credentials";
import { GetPullRequestFilesQuery } from "./get-pull-request-files.query";

@Injectable()
@QueryHandler(GetPullRequestFilesQuery)
export class GetPullRequestFilesHandler implements IQueryHandler<GetPullRequestFilesQuery, GithubPullRequestFilePage> {
	public constructor(
		private readonly credentials: GithubLinkedCredentials,
		@Inject(GITHUB_PULL_REQUEST_READS) private readonly reads: GithubPullRequestReadsPort,
	) {}

	public execute(query: GetPullRequestFilesQuery): Promise<GithubPullRequestFilePage> {
		return this.credentials.withCredential(query.actor, (linked) => this.reads.files(githubUserIdOf(query.actor), linked, query.input.params, query.input.page));
	}
}

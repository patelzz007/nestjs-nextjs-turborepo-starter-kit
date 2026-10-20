import { Inject, Injectable } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { GithubTimelinePage } from "@workspace/shared";

import type { GithubPullRequestReadsPort } from "../../ports/github-pull-requests.port";
import { GITHUB_PULL_REQUEST_READS } from "../../ports/github.tokens";
import { githubUserIdOf } from "../../github-user-actor";
import { GithubLinkedCredentials } from "../../services/github-linked-credentials";
import { GetPullRequestTimelineQuery } from "./get-pull-request-timeline.query";

@Injectable()
@QueryHandler(GetPullRequestTimelineQuery)
export class GetPullRequestTimelineHandler implements IQueryHandler<GetPullRequestTimelineQuery, GithubTimelinePage> {
	public constructor(
		private readonly credentials: GithubLinkedCredentials,
		@Inject(GITHUB_PULL_REQUEST_READS) private readonly reads: GithubPullRequestReadsPort,
	) {}

	public execute(query: GetPullRequestTimelineQuery): Promise<GithubTimelinePage> {
		return this.credentials.withCredential(query.actor, (linked) => this.reads.timeline(githubUserIdOf(query.actor), linked, query.input.params, query.input.cursor));
	}
}

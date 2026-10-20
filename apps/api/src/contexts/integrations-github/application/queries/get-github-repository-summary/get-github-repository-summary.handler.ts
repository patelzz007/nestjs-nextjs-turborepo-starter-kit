import { Inject, Injectable } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { GithubRepositorySummary } from "@workspace/shared";

import type { GithubContributionsPort } from "../../ports/github-contributions.port";
import { GITHUB_CONTRIBUTIONS } from "../../ports/github.tokens";
import { GetGithubRepositorySummaryQuery } from "./get-github-repository-summary.query";

@Injectable()
@QueryHandler(GetGithubRepositorySummaryQuery)
export class GetGithubRepositorySummaryHandler implements IQueryHandler<GetGithubRepositorySummaryQuery, GithubRepositorySummary> {
	public constructor(@Inject(GITHUB_CONTRIBUTIONS) private readonly contributions: GithubContributionsPort) {}

	public execute(query: GetGithubRepositorySummaryQuery): Promise<GithubRepositorySummary> {
		return this.contributions.getRepositorySummary(query.input);
	}
}

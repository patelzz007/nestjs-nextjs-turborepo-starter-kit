import { Inject, Injectable } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { GithubContributorStats } from "@workspace/shared";

import type { GithubContributionsPort } from "../../ports/github-contributions.port";
import { GITHUB_CONTRIBUTIONS } from "../../ports/github.tokens";
import { GetGithubContributorStatsQuery } from "./get-github-contributor-stats.query";

@Injectable()
@QueryHandler(GetGithubContributorStatsQuery)
export class GetGithubContributorStatsHandler implements IQueryHandler<GetGithubContributorStatsQuery, GithubContributorStats> {
	public constructor(@Inject(GITHUB_CONTRIBUTIONS) private readonly contributions: GithubContributionsPort) {}

	public execute(query: GetGithubContributorStatsQuery): Promise<GithubContributorStats> {
		return this.contributions.getContributorStats(query.input);
	}
}

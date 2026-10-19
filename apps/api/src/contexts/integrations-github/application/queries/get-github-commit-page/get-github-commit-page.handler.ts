import { Inject, Injectable } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { GithubCommitPage } from "@workspace/shared";

import type { GithubContributionsPort } from "../../ports/github-contributions.port";
import { GITHUB_CONTRIBUTIONS } from "../../ports/github.tokens";
import { GetGithubCommitPageQuery } from "./get-github-commit-page.query";

@Injectable()
@QueryHandler(GetGithubCommitPageQuery)
export class GetGithubCommitPageHandler implements IQueryHandler<GetGithubCommitPageQuery, GithubCommitPage> {
	public constructor(@Inject(GITHUB_CONTRIBUTIONS) private readonly contributions: GithubContributionsPort) {}

	public execute(query: GetGithubCommitPageQuery): Promise<GithubCommitPage> {
		return this.contributions.getCommitPage(query.input.params, query.input.query);
	}
}

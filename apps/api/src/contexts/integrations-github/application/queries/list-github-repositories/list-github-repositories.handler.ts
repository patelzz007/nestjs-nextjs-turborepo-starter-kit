import { Inject, Injectable } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { GithubRepositoryList } from "@workspace/shared";

import type { GithubContributionsPort } from "../../ports/github-contributions.port";
import { GITHUB_CONTRIBUTIONS } from "../../ports/github.tokens";
import { ListGithubRepositoriesQuery } from "./list-github-repositories.query";

@Injectable()
@QueryHandler(ListGithubRepositoriesQuery)
export class ListGithubRepositoriesHandler implements IQueryHandler<ListGithubRepositoriesQuery, GithubRepositoryList> {
	public constructor(@Inject(GITHUB_CONTRIBUTIONS) private readonly contributions: GithubContributionsPort) {}

	public execute(_query: ListGithubRepositoriesQuery): Promise<GithubRepositoryList> {
		return this.contributions.listRepositories();
	}
}

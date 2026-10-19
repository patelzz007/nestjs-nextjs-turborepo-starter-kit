import { Inject, Injectable } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { GithubCommitDetail } from "@workspace/shared";

import type { GithubContributionsPort } from "../../ports/github-contributions.port";
import { GITHUB_CONTRIBUTIONS } from "../../ports/github.tokens";
import { GetGithubCommitQuery } from "./get-github-commit.query";

@Injectable()
@QueryHandler(GetGithubCommitQuery)
export class GetGithubCommitHandler implements IQueryHandler<GetGithubCommitQuery, GithubCommitDetail> {
	public constructor(@Inject(GITHUB_CONTRIBUTIONS) private readonly contributions: GithubContributionsPort) {}

	public execute(query: GetGithubCommitQuery): Promise<GithubCommitDetail> {
		return this.contributions.getCommit(query.input);
	}
}

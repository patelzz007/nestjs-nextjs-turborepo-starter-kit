import { Injectable } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { GithubAccountStatus } from "@workspace/shared";

import { GithubLinkedCredentials } from "../../services/github-linked-credentials";
import { GetGithubAccountStatusQuery } from "./get-github-account-status.query";

@Injectable()
@QueryHandler(GetGithubAccountStatusQuery)
export class GetGithubAccountStatusHandler implements IQueryHandler<GetGithubAccountStatusQuery, GithubAccountStatus> {
	public constructor(private readonly credentials: GithubLinkedCredentials) {}

	public execute(query: GetGithubAccountStatusQuery): Promise<GithubAccountStatus> {
		return this.credentials.status(query.actor);
	}
}

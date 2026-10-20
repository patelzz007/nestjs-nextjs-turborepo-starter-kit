import { Injectable } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { GithubLiveUpdatesStatus } from "@workspace/shared";

import { GithubLiveUpdatesStatusReader } from "../../services/github-live-updates-status";
import { githubUserIdOf } from "../../github-user-actor";
import { GetLiveUpdatesStatusQuery } from "./get-live-updates-status.query";

@Injectable()
@QueryHandler(GetLiveUpdatesStatusQuery)
export class GetLiveUpdatesStatusHandler implements IQueryHandler<GetLiveUpdatesStatusQuery, GithubLiveUpdatesStatus> {
	public constructor(private readonly liveUpdates: GithubLiveUpdatesStatusReader) {}

	public async execute(query: GetLiveUpdatesStatusQuery): Promise<GithubLiveUpdatesStatus> {
		const userId = githubUserIdOf(query.actor);
		return this.liveUpdates.status(userId, query.input);
	}
}

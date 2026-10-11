import { Module } from "@nestjs/common";

import { GITHUB_FETCH, GLOBAL_GITHUB_FETCH, GithubApiClient } from "./github-api.client";
import { GITHUB_CLOCK, GithubContributionsService, SYSTEM_GITHUB_CLOCK } from "./github-contributions.service";
import { GithubController } from "./github.controller";

/** Read-only GitHub contributions of the configured repositories (docs/technical/github-contributions.md). */
@Module({
	controllers: [GithubController],
	providers: [GithubApiClient, GithubContributionsService, { provide: GITHUB_FETCH, useValue: GLOBAL_GITHUB_FETCH }, { provide: GITHUB_CLOCK, useValue: SYSTEM_GITHUB_CLOCK }],
})
export class GithubModule {}

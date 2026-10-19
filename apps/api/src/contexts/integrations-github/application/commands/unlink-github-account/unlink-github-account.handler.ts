import { Inject, Injectable } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { GithubAccountStatus } from "@workspace/shared";

import { GithubLinkedCredentials } from "../../services/github-linked-credentials";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { GithubScope } from "../../github-scope";
import { githubUserIdOf } from "../../github-user-actor";
import type { GithubPullRequestCachePort } from "../../ports/github-pull-request-cache.port";
import { GITHUB_PULL_REQUEST_CACHE, GITHUB_UNIT_OF_WORK } from "../../ports/github.tokens";
import { UnlinkGithubAccountCommand } from "./unlink-github-account.command";

@Injectable()
@CommandHandler(UnlinkGithubAccountCommand)
export class UnlinkGithubAccountHandler implements ICommandHandler<UnlinkGithubAccountCommand, GithubAccountStatus> {
	public constructor(
		private readonly credentials: GithubLinkedCredentials,
		@Inject(GITHUB_UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork<GithubScope>,
		@Inject(GITHUB_PULL_REQUEST_CACHE) private readonly cache: GithubPullRequestCachePort,
	) {}

	public async execute(command: UnlinkGithubAccountCommand): Promise<GithubAccountStatus> {
		this.credentials.assertEnabled();
		const userId = githubUserIdOf(command.actor);
		await this.unitOfWork.run(command.actor, (scope: GithubScope): Promise<boolean> => scope.accountLinks.unlink(userId, userId));
		this.cache.invalidateUser(userId);
		return { status: "unlinked" };
	}
}

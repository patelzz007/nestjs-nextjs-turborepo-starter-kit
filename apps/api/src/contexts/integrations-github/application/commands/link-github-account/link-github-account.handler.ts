import { Inject, Injectable } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { GithubAccountLoginSchema, type GithubAccountStatus } from "@workspace/shared";

import { GithubLinkedCredentials, toLinkedStatus } from "../../services/github-linked-credentials";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { GithubLinkedTokenRejectedError, githubTokenInvalid } from "../../errors/github.errors";
import type { GithubScope } from "../../github-scope";
import { githubUserIdOf } from "../../github-user-actor";
import type { GithubTokenCipherPort, GithubTokenOwner, GithubTokenOwnerPort } from "../../ports/github-credentials.port";
import type { GithubPullRequestCachePort } from "../../ports/github-pull-request-cache.port";
import { GITHUB_PULL_REQUEST_CACHE, GITHUB_TOKEN_CIPHER, GITHUB_TOKEN_OWNER, GITHUB_UNIT_OF_WORK } from "../../ports/github.tokens";
import { LinkGithubAccountCommand } from "./link-github-account.command";

@Injectable()
@CommandHandler(LinkGithubAccountCommand)
export class LinkGithubAccountHandler implements ICommandHandler<LinkGithubAccountCommand, GithubAccountStatus> {
	public constructor(
		private readonly credentials: GithubLinkedCredentials,
		@Inject(GITHUB_TOKEN_CIPHER) private readonly cipher: GithubTokenCipherPort,
		@Inject(GITHUB_TOKEN_OWNER) private readonly tokenOwners: GithubTokenOwnerPort,
		@Inject(GITHUB_UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork<GithubScope>,
		@Inject(GITHUB_PULL_REQUEST_CACHE) private readonly cache: GithubPullRequestCachePort,
	) {}

	public async execute(command: LinkGithubAccountCommand): Promise<GithubAccountStatus> {
		const { actor, input } = command;
		this.credentials.assertEnabled();
		const userId = githubUserIdOf(actor);
		const owner = await this.fetchOwner(input.personalAccessToken);
		const login = GithubAccountLoginSchema.parse(owner.login);
		const link = await this.unitOfWork.run(actor, (scope: GithubScope) =>
			scope.accountLinks.upsert({
				userId,
				githubUserId: owner.githubUserId,
				githubLogin: login,
				token: this.cipher.encrypt(input.personalAccessToken, userId),
				tokenExpiresAt: owner.tokenExpiresAt,
			}),
		);
		this.cache.invalidateUser(userId);
		return toLinkedStatus(link);
	}

	private async fetchOwner(token: string): Promise<GithubTokenOwner> {
		try {
			return await this.tokenOwners.fetchTokenOwner(token);
		} catch (error: unknown) {
			if (error instanceof GithubLinkedTokenRejectedError) {
				throw githubTokenInvalid();
			}
			throw error;
		}
	}
}

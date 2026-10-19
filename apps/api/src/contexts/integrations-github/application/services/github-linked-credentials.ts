// ============================================
// github-linked-credentials.ts - Each admin's own linked GitHub token (ADR 052)
// ============================================
// The one place a linked token is read back for use. Everything else asks for
// a `LinkedGithubCredential` and never sees how the token is kept. A GitHub
// App could replace the personal token here without touching the routes.

import { Inject, Injectable, Logger } from "@nestjs/common";
import { epochMs, GithubAccountLoginSchema, type GithubAccountStatus } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { UnitOfWork } from "../../../../platform/application/unit-of-work.port";
import { GithubAccountNotLinkedError, GithubLinkedTokenRejectedError, GithubPullRequestsOffError, GithubStoredTokenUnreadableError } from "../errors/github.errors";
import type { GithubScope } from "../github-scope";
import { githubUserIdOf } from "../github-user-actor";
import type { GithubAccountLinkReadPort, GithubAccountLinkRecord } from "../ports/github-account-link.port";
import type { GithubTokenCipherPort, LinkedGithubCredential } from "../ports/github-credentials.port";
import type { GithubPullRequestCachePort } from "../ports/github-pull-request-cache.port";
import { GITHUB_ACCOUNT_LINK_READS, GITHUB_PULL_REQUEST_CACHE, GITHUB_TOKEN_CIPHER, GITHUB_UNIT_OF_WORK } from "../ports/github.tokens";

/** GitHub's avatar of an account, by its numeric id — stable across login renames. */
function avatarUrlOf(githubUserId: number): string {
	return `https://avatars.githubusercontent.com/u/${String(githubUserId)}`;
}

/** The status the app shows for a live link — never the token. */
export function toLinkedStatus(link: GithubAccountLinkRecord): GithubAccountStatus {
	return {
		status: "linked",
		login: GithubAccountLoginSchema.parse(link.githubLogin),
		avatarUrl: avatarUrlOf(link.githubUserId),
		health: link.status === "REJECTED" ? "rejected" : "active",
		linkedAt: epochMs(link.linkedAt),
		tokenExpiresAt: link.tokenExpiresAt === null ? null : epochMs(link.tokenExpiresAt),
	};
}

@Injectable()
export class GithubLinkedCredentials {
	private readonly logger: Logger = new Logger(GithubLinkedCredentials.name);

	public constructor(
		@Inject(GITHUB_TOKEN_CIPHER) private readonly cipher: GithubTokenCipherPort,
		@Inject(GITHUB_ACCOUNT_LINK_READS) private readonly links: GithubAccountLinkReadPort,
		@Inject(GITHUB_UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork<GithubScope>,
		@Inject(GITHUB_PULL_REQUEST_CACHE) private readonly cache: GithubPullRequestCachePort,
	) {}

	/** Throws {@link GithubPullRequestsOffError} when the deployment cannot store tokens. */
	public assertEnabled(): void {
		if (!this.cipher.isEnabled()) {
			throw new GithubPullRequestsOffError();
		}
	}

	/** `off`, `unlinked`, or the linked account — never the token. */
	public async status(actor: ActorContext): Promise<GithubAccountStatus> {
		if (!this.cipher.isEnabled()) {
			return { status: "off" };
		}
		const link = await this.links.findLive(actor, githubUserIdOf(actor));
		return link === null ? { status: "unlinked" } : toLinkedStatus(link);
	}

	/**
	 * The caller's token for a GitHub request. Throws when pull requests are
	 * off, nothing is linked, or the token is known not to work.
	 */
	public async credentialFor(actor: ActorContext): Promise<LinkedGithubCredential> {
		this.assertEnabled();
		const userId = githubUserIdOf(actor);
		const link = await this.links.findLive(actor, userId);
		if (link === null) {
			throw new GithubAccountNotLinkedError();
		}
		if (link.status === "REJECTED") {
			throw new GithubLinkedTokenRejectedError();
		}
		try {
			return { token: this.cipher.decrypt(link.token, userId), login: link.githubLogin };
		} catch (error: unknown) {
			if (error instanceof GithubStoredTokenUnreadableError) {
				this.logger.error(`A linked GitHub token cannot be decrypted (user ${userId}): ${error.message} — asking its owner to link a new one`);
				await this.markRejected(actor, userId);
				throw new GithubLinkedTokenRejectedError();
			}
			throw error;
		}
	}

	/** Runs a GitHub read or write with the caller's token; a token GitHub refuses is recorded as rejected. */
	public async withCredential<T>(actor: ActorContext, use: (linked: LinkedGithubCredential) => Promise<T>): Promise<T> {
		const linked = await this.credentialFor(actor);
		try {
			return await use(linked);
		} catch (error: unknown) {
			if (error instanceof GithubLinkedTokenRejectedError) {
				const userId = githubUserIdOf(actor);
				await this.markRejected(actor, userId);
				this.cache.invalidateUser(userId);
			}
			throw error;
		}
	}

	private async markRejected(actor: ActorContext, userId: string): Promise<void> {
		await this.unitOfWork.run(actor, (scope: GithubScope): Promise<void> => scope.accountLinks.markRejected(userId));
	}
}

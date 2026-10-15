// ============================================
// github-credentials.service.ts - Each admin's own linked GitHub token (ADR 052)
// ============================================
// The one place a linked token is checked, stored, read back or forgotten.
// Everything else asks for a `LinkedGithubCredential` and never sees how the
// token is kept. A GitHub App could replace the personal token here without
// touching the routes.

import { Injectable, Logger } from "@nestjs/common";
import { GithubAccountLinkStatus } from "@prisma/client";
import { epochMs, GITHUB_PULL_REQUEST_ERROR_CODES, GithubAccountLoginSchema, type GithubAccountStatus } from "@workspace/shared";

import { ConflictError, ValidationError } from "../../../common/errors/app-error";
import { GithubLinkedTokenRejectedError } from "../github.errors";
import type { GithubCredential } from "../github-http.transport";
import { GithubAccountLinkRepository, type GithubAccountLinkRecord } from "./github-account-link.repository";
import { GithubCredentialCipher, GithubPullRequestsOffError, GithubStoredTokenUnreadableError } from "./github-credential.cipher";
import { GithubPullRequestCache } from "./github-pull-request.cache";
import { GithubPullRequestClient, type GithubTokenOwner } from "./github-pull-request.client";

/** Error code of {@link GithubAccountNotLinkedError}. */
export const GITHUB_ACCOUNT_NOT_LINKED_CODE = GITHUB_PULL_REQUEST_ERROR_CODES.accountNotLinked;
/** Error code of a token GitHub refused while linking it. */
export const GITHUB_TOKEN_INVALID_CODE = GITHUB_PULL_REQUEST_ERROR_CODES.tokenInvalid;

/** 409 — the caller has no linked token yet: link one first (`PUT /github/account`). */
export class GithubAccountNotLinkedError extends ConflictError {
	public constructor() {
		super({ code: GITHUB_ACCOUNT_NOT_LINKED_CODE, message: "Link your GitHub token to see pull requests." });
	}
}

/** GitHub's avatar of an account, by its numeric id — stable across login renames. */
function avatarUrlOf(githubUserId: number): string {
	return `https://avatars.githubusercontent.com/u/${String(githubUserId)}`;
}

/** The caller's token, ready to send, and the account it belongs to. */
export interface LinkedGithubCredential {
	readonly credential: GithubCredential;
	/** The token account's login — `yours` searches its repositories. */
	readonly login: string;
}

@Injectable()
export class GithubCredentialsService {
	private readonly logger: Logger = new Logger(GithubCredentialsService.name);

	public constructor(
		private readonly cipher: GithubCredentialCipher,
		private readonly links: GithubAccountLinkRepository,
		private readonly client: GithubPullRequestClient,
		private readonly cache: GithubPullRequestCache,
	) {}

	/** `off`, `unlinked`, or the linked account — never the token. */
	public async status(userId: string): Promise<GithubAccountStatus> {
		if (!this.cipher.isEnabled()) {
			return { status: "off" };
		}
		const link = await this.links.findLive(userId);
		return link === null ? { status: "unlinked" } : toLinkedStatus(link);
	}

	/**
	 * Checks `token` with GitHub (who it belongs to, when it expires), then
	 * stores it encrypted — replacing any earlier token of the caller.
	 */
	public async link(userId: string, token: string): Promise<GithubAccountStatus> {
		if (!this.cipher.isEnabled()) {
			throw new GithubPullRequestsOffError();
		}
		let owner: GithubTokenOwner;
		try {
			owner = await this.client.fetchTokenOwner({ source: "linked", token });
		} catch (error: unknown) {
			if (error instanceof GithubLinkedTokenRejectedError) {
				throw new ValidationError({ code: GITHUB_TOKEN_INVALID_CODE, message: "GitHub did not accept this token. Check it was copied whole and has not expired." });
			}
			throw error;
		}
		const login = GithubAccountLoginSchema.parse(owner.user.login);
		const link = await this.links.upsert({
			userId,
			githubUserId: owner.user.id,
			githubLogin: login,
			token: this.cipher.encrypt(token, userId),
			tokenExpiresAt: owner.tokenExpiresAt,
		});
		this.cache.invalidateUser(userId);
		return toLinkedStatus(link);
	}

	/** Forgets the caller's token (the row is kept, the token wiped). */
	public async unlink(userId: string): Promise<GithubAccountStatus> {
		if (!this.cipher.isEnabled()) {
			throw new GithubPullRequestsOffError();
		}
		await this.links.unlink(userId, userId);
		this.cache.invalidateUser(userId);
		return { status: "unlinked" };
	}

	/**
	 * The caller's token for a GitHub request. Throws when pull requests are
	 * off, nothing is linked, or the token is known not to work.
	 */
	public async credentialFor(userId: string): Promise<LinkedGithubCredential> {
		if (!this.cipher.isEnabled()) {
			throw new GithubPullRequestsOffError();
		}
		const link = await this.links.findLive(userId);
		if (link === null) {
			throw new GithubAccountNotLinkedError();
		}
		if (link.status === GithubAccountLinkStatus.REJECTED) {
			throw new GithubLinkedTokenRejectedError();
		}
		try {
			return { credential: { source: "linked", token: this.cipher.decrypt(link.token, userId) }, login: link.githubLogin };
		} catch (error: unknown) {
			if (error instanceof GithubStoredTokenUnreadableError) {
				this.logger.error(`A linked GitHub token cannot be decrypted (user ${userId}): ${error.message} — asking its owner to link a new one`);
				await this.links.markRejected(userId);
				throw new GithubLinkedTokenRejectedError();
			}
			throw error;
		}
	}

	/** Runs a GitHub read or write with the caller's token; a token GitHub refuses is recorded as rejected. */
	public async withCredential<T>(userId: string, use: (linked: LinkedGithubCredential) => Promise<T>): Promise<T> {
		const linked = await this.credentialFor(userId);
		try {
			return await use(linked);
		} catch (error: unknown) {
			if (error instanceof GithubLinkedTokenRejectedError) {
				await this.links.markRejected(userId);
				this.cache.invalidateUser(userId);
			}
			throw error;
		}
	}
}

function toLinkedStatus(link: GithubAccountLinkRecord): GithubAccountStatus {
	return {
		status: "linked",
		login: GithubAccountLoginSchema.parse(link.githubLogin),
		avatarUrl: avatarUrlOf(link.githubUserId),
		health: link.status === GithubAccountLinkStatus.REJECTED ? "rejected" : "active",
		linkedAt: epochMs(link.linkedAt),
		tokenExpiresAt: link.tokenExpiresAt === null ? null : epochMs(link.tokenExpiresAt),
	};
}

import { GITHUB_PULL_REQUEST_ERROR_CODES, toGithubFullName, type GithubCommitParams, type GithubPullRequestParams, type GithubRepositoryParams } from "@workspace/shared";

import { ConflictError, DependencyUnavailableError, ExternalServiceError, NotFoundError } from "../../common/errors/app-error";

/**
 * What one GitHub request is about: one repository, one commit of it, the
 * server token's own account (discovering its repositories), one pull request,
 * one comment-like node, or an admin's linked account. Errors and logs name it.
 */
export type GithubReadTarget =
	| { readonly kind: "repository"; readonly params: GithubRepositoryParams }
	| { readonly kind: "commit"; readonly params: GithubCommitParams }
	| { readonly kind: "account" }
	| { readonly kind: "pullRequest"; readonly params: GithubPullRequestParams }
	| { readonly kind: "content"; readonly nodeId: string }
	| { readonly kind: "repositoryFile"; readonly params: GithubRepositoryFileParams }
	| { readonly kind: "linkedAccount" }
	| { readonly kind: "search" };

/** A file in a repository at a ref — a comment picture committed there, or one a comment shows. */
export interface GithubRepositoryFileParams extends GithubRepositoryParams {
	readonly ref: string;
	readonly path: string;
}

/** The token's account as a read target. */
export const GITHUB_ACCOUNT_TARGET: GithubReadTarget = { kind: "account" };

export function repositoryTarget(params: GithubRepositoryParams): GithubReadTarget {
	return { kind: "repository", params };
}

export function commitTarget(params: GithubCommitParams): GithubReadTarget {
	return { kind: "commit", params };
}

export function pullRequestTarget(params: GithubPullRequestParams): GithubReadTarget {
	return { kind: "pullRequest", params };
}

export function repositoryFileTarget(params: GithubRepositoryFileParams): GithubReadTarget {
	return { kind: "repositoryFile", params };
}

export function contentTarget(nodeId: string): GithubReadTarget {
	return { kind: "content", nodeId };
}

/** An admin's linked token's own account (checking it on link). */
export const GITHUB_LINKED_ACCOUNT_TARGET: GithubReadTarget = { kind: "linkedAccount" };

/** A pull-request search of an admin's linked account. */
export const GITHUB_SEARCH_TARGET: GithubReadTarget = { kind: "search" };

/** `octo-org/hello-world`, `octo-org/hello-world@a1b2…`, or the token's account — for logs and server-side causes only. */
export function describeTarget(target: GithubReadTarget): string {
	switch (target.kind) {
		case "repository":
			return toGithubFullName(target.params);
		case "commit":
			return `${toGithubFullName(target.params)}@${target.params.sha}`;
		case "account":
			return "the GITHUB_TOKEN account";
		case "pullRequest":
			return `${toGithubFullName(target.params)}#${String(target.params.number)}`;
		case "content":
			return `node ${target.nodeId}`;
		case "repositoryFile":
			return `${toGithubFullName(target.params)}:${target.params.ref}:${target.params.path}`;
		case "linkedAccount":
			return "a linked account";
		case "search":
			return "a pull-request search";
	}
}

/**
 * 404 — the repository is not one the API may read (not pinned in
 * `GITHUB_REPOSITORIES`, or not discovered from the token's account). Same
 * answer whether or not it exists on GitHub: the API never reveals, or spends
 * its token on, a repository outside that list.
 */
export class GithubRepositoryNotConfiguredError extends NotFoundError {
	public constructor(public readonly params: GithubRepositoryParams) {
		super({ message: "This GitHub repository is not available." });
	}
}

/** 404 — a listed repository GitHub does not show the token (renamed, deleted, or access removed). */
export class GithubRepositoryNotFoundError extends NotFoundError {
	public constructor(public readonly params: GithubRepositoryParams) {
		super({ message: "This GitHub repository could not be found on GitHub." });
	}
}

/**
 * 404 — the repository is listed but has no commit with this SHA (never
 * pushed, or rewritten away), or GitHub no longer shows the repository.
 */
export class GithubCommitNotFoundError extends NotFoundError {
	public constructor(public readonly params: GithubCommitParams) {
		super({ message: "This commit could not be found on GitHub." });
	}
}

/** 404 — no such pull request, or the linked token cannot see it (GitHub answers both the same). */
export class GithubPullRequestNotFoundError extends NotFoundError {
	public constructor(public readonly params: GithubPullRequestParams) {
		super({ message: "This pull request could not be found on GitHub, or your GitHub token cannot see it." });
	}
}

/** 404 — no such comment, or the linked token cannot see it. */
export class GithubContentNotFoundError extends NotFoundError {
	public constructor(public readonly nodeId: string) {
		super({ message: "This comment could not be found on GitHub, or your GitHub token cannot see it." });
	}
}

export class GithubRepositoryFileNotFoundError extends NotFoundError {
	public constructor(public readonly params: GithubRepositoryFileParams) {
		super({ message: "This file could not be found on GitHub, or your GitHub token cannot see it." });
	}
}

/** Error code of {@link GithubLinkedTokenRejectedError} — the app asks for a new token on it. */
export const GITHUB_TOKEN_REJECTED_CODE = GITHUB_PULL_REQUEST_ERROR_CODES.tokenRejected;

/**
 * 409 — GitHub refused an admin's linked token (revoked or expired). Not a
 * transient failure: the admin must link a new token, so no cached answer
 * stands in for it.
 */
export class GithubLinkedTokenRejectedError extends ConflictError {
	public constructor() {
		super({ code: GITHUB_TOKEN_REJECTED_CODE, message: "GitHub no longer accepts your token. Link a new one to continue." });
	}
}

/**
 * 409 — a comment or review links a picture attached from the app whose
 * upload is gone (unused for longer than its category keeps it) and that was
 * never committed: posting it would show a broken picture. Attach it again.
 */
export class GithubPictureUnavailableError extends ConflictError {
	public constructor(public readonly fileId: string) {
		super({
			code: GITHUB_PULL_REQUEST_ERROR_CODES.pictureUnavailable,
			message: "A picture in this comment is no longer available. Remove it, attach it again, then post.",
		});
	}
}

/** Why GitHub refused a write: the token lacks the permission (403), or GitHub's rules forbid it (422). */
export type GithubWriteRefusal = "forbidden" | "unprocessable";

/** The fine-grained token permission a write needs, as GitHub's token page names it. */
export type GithubTokenWritePermission = "Pull requests" | "Contents" | "Webhooks";

/**
 * 409 — GitHub refused a write. `forbidden`: the linked token may not do it
 * in that repository — the message names the permission to give it ("Pull
 * requests" to comment, "Contents" to commit a picture, "Webhooks" for live
 * updates). `unprocessable`: GitHub's own rules (approving your own pull
 * request, a locked conversation) — its reason is the message.
 */
export class GithubWriteRejectedError extends ConflictError {
	public constructor(
		public readonly refusal: GithubWriteRefusal,
		githubReason: string,
		repository: string,
		permission: GithubTokenWritePermission,
	) {
		super({
			code: GITHUB_PULL_REQUEST_ERROR_CODES.writeRejected,
			message:
				refusal === "forbidden"
					? `Your GitHub token can't write to ${repository}. Give it "${permission}: Read and write" access to that repository on GitHub, then try again.`
					: `GitHub refused this: ${githubReason}`,
		});
	}
}

/** Why GitHub could not answer right now — every one of them may succeed on retry. */
export type GithubUnavailableReason = "timeout" | "unreachable" | "rate-limited";

const UNAVAILABLE_MESSAGES: Readonly<Record<GithubUnavailableReason, string>> = {
	timeout: "GitHub did not answer in time. Try again shortly.",
	unreachable: "GitHub could not be reached. Try again shortly.",
	"rate-limited": "GitHub's request limit is used up. Try again later.",
};

/** 503 — GitHub is slow, unreachable or rate-limiting the API's token. */
export class GithubUnavailableError extends DependencyUnavailableError {
	public constructor(
		public readonly reason: GithubUnavailableReason,
		cause?: Error,
	) {
		super({ message: UNAVAILABLE_MESSAGES[reason], ...(cause === undefined ? {} : { cause }) });
	}
}

/** What went wrong with an answer GitHub did give. Logged; the client sees one generic message. */
export type GithubResponseProblem = "credentials-rejected" | "unexpected-status" | "unexpected-body" | "graphql-error";

/** 502 — GitHub answered, but not with something usable (bad token, server error, unexpected shape). */
export class GithubResponseError extends ExternalServiceError {
	public constructor(
		public readonly problem: GithubResponseProblem,
		public readonly target: GithubReadTarget,
		detail: string,
	) {
		super({ message: "GitHub answered with an error.", cause: new Error(`GitHub ${problem} for ${describeTarget(target)}: ${detail}`) });
	}
}

/** Failures that say nothing about the repository itself — the last good answer may stand in for a fresh one. */
export function isGithubTransientFailure(error: Error): error is GithubUnavailableError | GithubResponseError {
	return error instanceof GithubUnavailableError || error instanceof GithubResponseError;
}

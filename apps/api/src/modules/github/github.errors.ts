import { toGithubFullName, type GithubRepositoryParams } from "@workspace/shared";

import { DependencyUnavailableError, ExternalServiceError, NotFoundError } from "../../common/errors/app-error";

/**
 * What one GitHub read is about: one repository, or the token's own account
 * (discovering its repositories). Errors and logs name it.
 */
export type GithubReadTarget = { readonly kind: "repository"; readonly params: GithubRepositoryParams } | { readonly kind: "account" };

/** The token's account as a read target. */
export const GITHUB_ACCOUNT_TARGET: GithubReadTarget = { kind: "account" };

export function repositoryTarget(params: GithubRepositoryParams): GithubReadTarget {
	return { kind: "repository", params };
}

/** `octo-org/hello-world`, or "the token's account" — for logs and server-side causes only. */
export function describeTarget(target: GithubReadTarget): string {
	return target.kind === "repository" ? toGithubFullName(target.params) : "the GITHUB_TOKEN account";
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

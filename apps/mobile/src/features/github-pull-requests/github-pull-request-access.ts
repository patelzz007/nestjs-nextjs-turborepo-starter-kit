// Whether this person can use GitHub pull requests (ADR 052), and what a
// failed read asks of them. The API decides: an account the API refuses (403 —
// not an admin) or a server with pull requests off is "unavailable", and the
// drawer then shows no GitHub section. The app only hides what the API would
// refuse anyway.

import { ApiError } from "@workspace/api-client";
import { GITHUB_PULL_REQUEST_ERROR_CODES, type GithubAccountStatus } from "@workspace/shared";

import { useApi } from "../../lib/api-context";

export type GithubPullRequestAccess = { readonly kind: "checking" } | { readonly kind: "unavailable" } | { readonly kind: "available"; readonly account: GithubAccountStatus };

export function useGithubPullRequestAccess(): GithubPullRequestAccess {
	const api = useApi();
	const account = api.githubPullRequests.account.useQuery(undefined);
	const status = account.data?.data;
	if (status !== undefined) {
		return status.status === "off" ? { kind: "unavailable" } : { kind: "available", account: status };
	}
	return account.isError ? { kind: "unavailable" } : { kind: "checking" };
}

/** A read that failed because there is no working token: the screen offers to link one instead of a retry. */
export function needsTokenLink(error: Error): boolean {
	return error instanceof ApiError && (error.code === GITHUB_PULL_REQUEST_ERROR_CODES.accountNotLinked || error.code === GITHUB_PULL_REQUEST_ERROR_CODES.tokenRejected);
}

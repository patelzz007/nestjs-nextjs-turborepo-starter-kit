// The `?owner=&repository=&number=` every pull-request screen is opened with
// (and `&sha=` for one of its commits) —
// parsed with the shared contract (a deep link included), and built back for
// navigation in one place.

import { GithubPullRequestCommitParamsSchema, GithubPullRequestParamsSchema, type GithubPullRequestCommitParams, type GithubPullRequestParams } from "@workspace/shared";
import { z } from "zod";

/** The route's params: the contract's pull-request params, other search params ignored. */
export const PullRequestRouteParamsSchema = z.object(GithubPullRequestParamsSchema.shape);

/** Expo Router passes search params as strings. */
export interface PullRequestRouteParams extends Record<string, string> {
	readonly owner: string;
	readonly repository: string;
	readonly number: string;
}

export function toPullRequestRouteParams(pullRequest: GithubPullRequestParams): PullRequestRouteParams {
	return { owner: pullRequest.owner, repository: pullRequest.repository, number: String(pullRequest.number) };
}

/** A pull request's commit route: the pull request's params plus the commit's SHA. */
export const PullRequestCommitRouteParamsSchema = z.object(GithubPullRequestCommitParamsSchema.shape);

export interface PullRequestCommitRouteParams extends PullRequestRouteParams {
	readonly sha: string;
}

export function toPullRequestCommitRouteParams(commit: GithubPullRequestCommitParams): PullRequestCommitRouteParams {
	return { ...toPullRequestRouteParams(commit), sha: commit.sha };
}

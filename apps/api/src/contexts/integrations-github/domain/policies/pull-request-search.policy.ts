// The search a pull-request list sends to GitHub, built from a closed set of
// filters (ADR 052): no client-supplied text is ever part of it.

import { assertNever, type GithubPullRequestFilter, type GithubPullRequestStateFilter } from "@workspace/shared";

/** What every search asks for, whatever the filter: pull requests, in repositories that are not archived, most recently updated first. */
const SEARCH_BASE = ["is:pr", "archived:false", "sort:updated-desc"];

const STATE_QUALIFIERS: Readonly<Record<GithubPullRequestStateFilter, string>> = {
	open: "is:open",
	closed: "is:closed",
};

/** The search qualifier of a filter. `login` is the linked account's, as GitHub reported it (a validated login, no spaces). */
export function filterQualifier(filter: GithubPullRequestFilter, login: string): string {
	switch (filter) {
		case "yours":
			return `user:${login}`;
		case "created":
			return "author:@me";
		case "reviewRequested":
			return "review-requested:@me";
		case "assigned":
			return "assignee:@me";
		case "mentioned":
			return "mentions:@me";
		default:
			return assertNever(filter, "pull request filter");
	}
}

/** The whole search query for a filter and state — every part comes from this file or GitHub, none from the client. */
export function buildPullRequestSearch(filter: GithubPullRequestFilter, state: GithubPullRequestStateFilter, login: string): string {
	return [...SEARCH_BASE, STATE_QUALIFIERS[state], filterQualifier(filter, login)].join(" ");
}

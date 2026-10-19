// Reloading pull-request views. Every pull-request query key starts with one
// root (the api-client router), and every view of one pull request shares a
// prefix — so a link change reloads everything, and a change to one pull
// request reloads all of its views at once.

import { githubLiveUpdatesKey, githubPullRequestScopeKey, githubPullRequestsRootKey, type GithubPullRequestScope } from "@workspace/api-client";
import type { QueryClient } from "@tanstack/react-query";

/** Everything pull-request related — after linking, replacing or removing the token. */
export async function refreshAllPullRequests(queryClient: QueryClient): Promise<void> {
	await queryClient.invalidateQueries({ queryKey: githubPullRequestsRootKey() });
}

/** Every view of one pull request (detail, conversation, commits, files, threads). */
export async function refreshPullRequest(queryClient: QueryClient, scope: GithubPullRequestScope): Promise<void> {
	await queryClient.invalidateQueries({ queryKey: githubPullRequestScopeKey(scope) });
}

/** Whether one repository has live updates — after turning them on or off. */
export async function refreshLiveUpdates(queryClient: QueryClient, owner: string, repository: string): Promise<void> {
	await queryClient.invalidateQueries({ queryKey: githubLiveUpdatesKey(owner, repository) });
}

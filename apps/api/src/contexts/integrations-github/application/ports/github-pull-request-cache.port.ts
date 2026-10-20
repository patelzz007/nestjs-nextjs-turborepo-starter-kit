/** Drops cached pull-request answers when a write, a webhook or a link change says they changed. */
export interface GithubPullRequestCachePort {
	/** Everything cached for one user — their link changed, so their token did. */
	invalidateUser(userId: string): void;
	/** Everything about one pull request, for every user, and every list. */
	invalidatePullRequest(owner: string, repository: string, number: number): void;
}

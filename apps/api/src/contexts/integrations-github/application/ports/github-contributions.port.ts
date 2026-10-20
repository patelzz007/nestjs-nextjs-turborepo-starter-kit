import type {
	GithubCommitDetail,
	GithubCommitHistoryQuery,
	GithubCommitPage,
	GithubCommitParams,
	GithubContributorStats,
	GithubRepositoryList,
	GithubRepositoryParams,
	GithubRepositorySummary,
} from "@workspace/shared";

/**
 * Read-only contributions of the repositories the API may read, with the
 * server's own token — answers mapped from GitHub into our contract and
 * cached for every caller. A repository outside the list is a 404.
 */
export interface GithubContributionsPort {
	listRepositories(): Promise<GithubRepositoryList>;
	getRepositorySummary(requested: GithubRepositoryParams): Promise<GithubRepositorySummary>;
	getCommitPage(requested: GithubRepositoryParams, query: GithubCommitHistoryQuery): Promise<GithubCommitPage>;
	getCommit(requested: GithubCommitParams): Promise<GithubCommitDetail>;
	getContributorStats(requested: GithubRepositoryParams): Promise<GithubContributorStats>;
}

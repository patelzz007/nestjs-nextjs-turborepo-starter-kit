import { Inject, Injectable } from "@nestjs/common";
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

import type { GithubContributionsPort } from "../ports/github-contributions.port";
import { GITHUB_CONTRIBUTIONS } from "../ports/github.tokens";

/**
 * The read-only contributions of the repositories the API may read (ADR 096). Read with the server's own token and
 * the same for every caller, so no read names the actor; a repository outside the list is a 404 from the port.
 */
@Injectable()
export class GithubContributionsApplicationService {
	public constructor(@Inject(GITHUB_CONTRIBUTIONS) private readonly contributions: GithubContributionsPort) {}

	public repositories(): Promise<GithubRepositoryList> {
		return this.contributions.listRepositories();
	}

	public repositorySummary(repository: GithubRepositoryParams): Promise<GithubRepositorySummary> {
		return this.contributions.getRepositorySummary(repository);
	}

	/** One page of the repository's default-branch history, newest first. */
	public commitPage(repository: GithubRepositoryParams, query: GithubCommitHistoryQuery): Promise<GithubCommitPage> {
		return this.contributions.getCommitPage(repository, query);
	}

	public commit(commit: GithubCommitParams): Promise<GithubCommitDetail> {
		return this.contributions.getCommit(commit);
	}

	public contributorStats(repository: GithubRepositoryParams): Promise<GithubContributorStats> {
		return this.contributions.getContributorStats(repository);
	}
}

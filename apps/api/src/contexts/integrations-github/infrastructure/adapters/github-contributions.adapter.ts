import { Inject, Injectable, Logger } from "@nestjs/common";
import {
	GITHUB_CONTRIBUTORS_HISTORY_MAX_COMMITS,
	toGithubFullName,
	type GithubCommitDetail,
	type GithubCommitHistoryQuery,
	type GithubCommitPage,
	type GithubCommitParams,
	type GithubContributorStats,
	type GithubRepositoryList,
	type GithubRepositoryListItem,
	type GithubRepositoryParams,
	type GithubRepositorySummary,
} from "@workspace/shared";

import { TypedConfigService } from "../../../../config/typed-config.service";
import { GithubApiClient } from "../github-api/github-api.client";
import { GITHUB_CACHE_MAX_ENTRIES, GITHUB_COMMIT_CACHE_MAX_ENTRIES, GITHUB_HISTORY_PAGE_MAX, GITHUB_STALE_FALLBACK_MS } from "../github-api/github.constants";
import { GithubRepositoryNotConfiguredError } from "../../application/errors/github.errors";
import {
	GITHUB_INTEGRATION_OFF,
	toCommitDetail,
	toCommitPage,
	toConfiguredRepositoryList,
	toDiscoveredRepositoryList,
	toHistoryContributors,
	toRepositorySummary,
	toStatisticsContributors,
} from "../github-api/github.mappers";
import type { GithubContributionCommitWire } from "../github-api/github.wire-schemas";
import { GithubResponseCache, type GithubResponseCacheOptions } from "../github-api/github-response.cache";
import type { GithubClock } from "../../application/ports/github-clock.port";
import type { GithubContributionsPort } from "../../application/ports/github-contributions.port";
import { GITHUB_CLOCK } from "../../application/ports/github.tokens";

/** The commits contributor totals were counted from, and whether they are the whole history. */
interface ContributionHistory {
	readonly commits: readonly GithubContributionCommitWire[];
	readonly complete: boolean;
}

/** The one cache key of the discovered list (it does not vary per caller). */
const DISCOVERED_LIST_KEY = "viewer";

/**
 * Read-only contributions of the repositories the API may read: the ones
 * pinned in `GITHUB_REPOSITORIES`, or — when that is empty — the token
 * account's own public repositories plus the public ones it contributed to.
 *
 * Every per-repository read first resolves the requested repository against
 * that list (case-insensitively, as GitHub does) and fails with a 404 for
 * anything else — the API's token is never spent on a repository a client
 * named. Answers are shared by every caller and cached (`GithubResponseCache`).
 */
@Injectable()
export class GithubContributionsAdapter implements GithubContributionsPort {
	private readonly logger: Logger = new Logger(GithubContributionsAdapter.name);
	private readonly discoveredLists: GithubResponseCache<GithubRepositoryList>;
	private readonly summaries: GithubResponseCache<GithubRepositorySummary>;
	private readonly commitPages: GithubResponseCache<GithubCommitPage>;
	private readonly commits: GithubResponseCache<GithubCommitDetail>;
	private readonly contributorStats: GithubResponseCache<GithubContributorStats>;

	public constructor(
		private readonly config: TypedConfigService,
		private readonly client: GithubApiClient,
		@Inject(GITHUB_CLOCK) clock: GithubClock,
	) {
		const cacheOptions: GithubResponseCacheOptions = { freshMs: config.github.cacheTtlMs, staleFallbackMs: GITHUB_STALE_FALLBACK_MS, maxEntries: GITHUB_CACHE_MAX_ENTRIES };
		this.discoveredLists = new GithubResponseCache<GithubRepositoryList>(cacheOptions, clock, this.logger);
		this.summaries = new GithubResponseCache<GithubRepositorySummary>(cacheOptions, clock, this.logger);
		this.commitPages = new GithubResponseCache<GithubCommitPage>(cacheOptions, clock, this.logger);
		this.commits = new GithubResponseCache<GithubCommitDetail>({ ...cacheOptions, maxEntries: GITHUB_COMMIT_CACHE_MAX_ENTRIES }, clock, this.logger);
		this.contributorStats = new GithubResponseCache<GithubContributorStats>(cacheOptions, clock, this.logger);
	}

	/**
	 * The repositories the API may read: `off` without a token, the pinned ones
	 * in the configured order, or the token account's discovered repositories
	 * (most recently pushed first, cached like every other answer).
	 */
	public async listRepositories(): Promise<GithubRepositoryList> {
		const { token, repositories } = this.config.github;
		if (token === null) {
			return GITHUB_INTEGRATION_OFF;
		}
		if (repositories.length > 0) {
			return toConfiguredRepositoryList(repositories);
		}
		return this.discoveredLists.read(DISCOVERED_LIST_KEY, async () => toDiscoveredRepositoryList(await this.client.fetchViewerRepositories()));
	}

	public async getRepositorySummary(requested: GithubRepositoryParams): Promise<GithubRepositorySummary> {
		const repository = await this.resolveAllowed(requested);
		return this.summaries.read(toGithubFullName(repository), async () => toRepositorySummary(repository, await this.client.fetchRepositorySummary(repository)));
	}

	/** One page of the default branch's history, newest first. */
	public async getCommitPage(requested: GithubRepositoryParams, query: GithubCommitHistoryQuery): Promise<GithubCommitPage> {
		const repository = await this.resolveAllowed(requested);
		const key = `${toGithubFullName(repository)}|${String(query.limit)}|${query.cursor ?? ""}`;
		return this.commitPages.read(key, async () => toCommitPage(await this.client.fetchCommitHistory(repository, { first: query.limit, after: query.cursor ?? null })));
	}

	/**
	 * One commit of a listed repository with its files and diffs. Any commit of
	 * the repository may be read, not only the default branch's: the repository
	 * is what the list allows, and every commit of it is as public as it is.
	 */
	public async getCommit(requested: GithubCommitParams): Promise<GithubCommitDetail> {
		const repository = await this.resolveAllowed(requested);
		const commit: GithubCommitParams = { ...repository, sha: requested.sha };
		return this.commits.read(`${toGithubFullName(repository)}@${commit.sha}`, async () => toCommitDetail(await this.client.fetchCommit(commit)));
	}

	/**
	 * Per-contributor totals: GitHub's statistics when it has them ready.
	 * GitHub recomputes those after every push and answers "still computing"
	 * (sometimes for many minutes) meanwhile — then the totals are counted from
	 * the default branch's latest commits instead, so they never wait on GitHub.
	 */
	public async getContributorStats(requested: GithubRepositoryParams): Promise<GithubContributorStats> {
		const repository = await this.resolveAllowed(requested);
		return this.contributorStats.read(toGithubFullName(repository), async () => {
			const statistics = await this.client.fetchContributorStats(repository);
			if (statistics.status === "ready") {
				return toStatisticsContributors(statistics.stats);
			}
			const { commits, complete } = await this.readContributionHistory(repository);
			return toHistoryContributors(commits, complete);
		});
	}

	/**
	 * The default branch's latest commits, newest first, page by page up to
	 * {@link GITHUB_CONTRIBUTORS_HISTORY_MAX_COMMITS}; `complete` when that is
	 * the whole history. An empty repository has none, and is complete.
	 */
	private async readContributionHistory(repository: GithubRepositoryParams): Promise<ContributionHistory> {
		const commits: GithubContributionCommitWire[] = [];
		let after: string | null = null;
		while (commits.length < GITHUB_CONTRIBUTORS_HISTORY_MAX_COMMITS) {
			const first = Math.min(GITHUB_HISTORY_PAGE_MAX, GITHUB_CONTRIBUTORS_HISTORY_MAX_COMMITS - commits.length);
			const page = await this.client.fetchContributionHistory(repository, { first, after });
			if (page === null) {
				return { commits, complete: true };
			}
			commits.push(...page.nodes);
			if (!page.pageInfo.hasNextPage || page.pageInfo.endCursor === null) {
				return { commits, complete: true };
			}
			after = page.pageInfo.endCursor;
		}
		return { commits, complete: false };
	}

	/** The listed repository the request names (in its listed spelling), or a 404. */
	private async resolveAllowed(requested: GithubRepositoryParams): Promise<GithubRepositoryParams> {
		const wanted = toGithubFullName(requested).toLowerCase();
		const { repositories } = await this.listRepositories();
		const allowed = repositories.find((repository: GithubRepositoryListItem): boolean => repository.fullName.toLowerCase() === wanted);
		if (allowed === undefined) {
			throw new GithubRepositoryNotConfiguredError(requested);
		}
		return { owner: allowed.owner, repository: allowed.repository };
	}
}

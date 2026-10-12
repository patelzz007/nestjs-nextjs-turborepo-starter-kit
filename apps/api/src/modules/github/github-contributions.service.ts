import { Inject, Injectable, Logger } from "@nestjs/common";
import {
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

import { TypedConfigService } from "../../config/typed-config.service";
import { GithubApiClient } from "./github-api.client";
import { GITHUB_CACHE_MAX_ENTRIES, GITHUB_COMMIT_CACHE_MAX_ENTRIES, GITHUB_STALE_FALLBACK_MS } from "./github.constants";
import { GithubRepositoryNotConfiguredError } from "./github.errors";
import {
	GITHUB_INTEGRATION_OFF,
	toCommitDetail,
	toCommitPage,
	toConfiguredRepositoryList,
	toContributorStats,
	toDiscoveredRepositoryList,
	toRepositorySummary,
} from "./github.mappers";
import { GithubResponseCache, type GithubClock, type GithubResponseCacheOptions } from "./github-response.cache";

export const GITHUB_CLOCK = Symbol("GITHUB_CLOCK");

export const SYSTEM_GITHUB_CLOCK: GithubClock = { nowEpochMs: (): number => Date.now() };

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
export class GithubContributionsService {
	private readonly logger: Logger = new Logger(GithubContributionsService.name);
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
		return this.discoveredLists.read(DISCOVERED_LIST_KEY, async () => ({ kind: "cacheable", value: toDiscoveredRepositoryList(await this.client.fetchViewerRepositories()) }));
	}

	public async getRepositorySummary(requested: GithubRepositoryParams): Promise<GithubRepositorySummary> {
		const repository = await this.resolveAllowed(requested);
		return this.summaries.read(toGithubFullName(repository), async () => ({
			kind: "cacheable",
			value: toRepositorySummary(repository, await this.client.fetchRepositorySummary(repository)),
		}));
	}

	/** One page of the default branch's history, newest first. */
	public async getCommitPage(requested: GithubRepositoryParams, query: GithubCommitHistoryQuery): Promise<GithubCommitPage> {
		const repository = await this.resolveAllowed(requested);
		const key = `${toGithubFullName(repository)}|${String(query.limit)}|${query.cursor ?? ""}`;
		return this.commitPages.read(key, async () => ({
			kind: "cacheable",
			value: toCommitPage(await this.client.fetchCommitHistory(repository, { first: query.limit, after: query.cursor ?? null })),
		}));
	}

	/**
	 * One commit of a listed repository with its files and diffs. Any commit of
	 * the repository may be read, not only the default branch's: the repository
	 * is what the list allows, and every commit of it is as public as it is.
	 */
	public async getCommit(requested: GithubCommitParams): Promise<GithubCommitDetail> {
		const repository = await this.resolveAllowed(requested);
		const commit: GithubCommitParams = { ...repository, sha: requested.sha };
		return this.commits.read(`${toGithubFullName(repository)}@${commit.sha}`, async () => ({
			kind: "cacheable",
			value: toCommitDetail(await this.client.fetchCommit(commit)),
		}));
	}

	/**
	 * Per-contributor totals. `computing` is never cached: GitHub is preparing
	 * the numbers and the next read may have them (meanwhile, the previous
	 * `ready` answer is served when there is one).
	 */
	public async getContributorStats(requested: GithubRepositoryParams): Promise<GithubContributorStats> {
		const repository = await this.resolveAllowed(requested);
		return this.contributorStats.read(toGithubFullName(repository), async () => {
			const stats = toContributorStats(await this.client.fetchContributorStats(repository));
			return { kind: stats.status === "ready" ? "cacheable" : "transient", value: stats };
		});
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

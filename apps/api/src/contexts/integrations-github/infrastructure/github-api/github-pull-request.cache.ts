// ============================================
// github-pull-request.cache.ts - Each admin's cached pull-request reads
// ============================================
// GitHub stays the source of truth (ADR 052); answers are reused for a short
// while per user — a user's token decides what they see, so nothing is shared
// between users. A write by the API, a webhook about a pull request, or a
// change of the user's link drops the affected answers.

import { Inject, Injectable, Logger } from "@nestjs/common";
import {
	type GithubCommitDetail,
	type GithubContentEditHistory,
	type GithubPullRequestCommitPage,
	type GithubPullRequestDetail,
	type GithubPullRequestFilePage,
	type GithubPullRequestPage,
	type GithubPullRequestStatus,
	type GithubReviewThreadList,
	type GithubTimelinePage,
} from "@workspace/shared";

import { GITHUB_STALE_FALLBACK_MS } from "./github.constants";
import type { GithubClock } from "../../application/ports/github-clock.port";
import type { GithubPullRequestCachePort } from "../../application/ports/github-pull-request-cache.port";
import { GITHUB_CLOCK } from "../../application/ports/github.tokens";
import { GithubResponseCache, type GithubResponseCacheOptions } from "./github-response.cache";

/**
 * How long a pull-request answer is reused before GitHub is read again. Short:
 * pull requests change while people work on them, and without webhooks
 * (local development) this is how stale a view can be.
 */
export const GITHUB_PULL_REQUEST_CACHE_FRESH_MS = 30_000;

/** Most cached small answers (lists, details, pages) per API instance, across all users. */
export const GITHUB_PULL_REQUEST_CACHE_MAX_ENTRIES = 500;

/** Most cached file pages — each can carry up to the commit diff budget of patches. */
export const GITHUB_PULL_REQUEST_FILE_CACHE_MAX_ENTRIES = 50;

/** Separates the parts of a cache key; never part of a user id, login, repository or cursor. */
const KEY_SEPARATOR = "|";

/** One pull request, as a key part: `owner/repository#number`, lowercase (GitHub names are case-insensitive). */
export function pullRequestKey(owner: string, repository: string, number: number): string {
	return `${owner}/${repository}#${String(number)}`.toLowerCase();
}

/** A cache key: the user first, so a user's answers are dropped together. */
export function cacheKey(userId: string, ...parts: readonly string[]): string {
	return [userId, ...parts].join(KEY_SEPARATOR);
}

const LIST_PART = "list";

@Injectable()
export class GithubPullRequestCache implements GithubPullRequestCachePort {
	public readonly lists: GithubResponseCache<GithubPullRequestPage>;
	public readonly details: GithubResponseCache<GithubPullRequestDetail>;
	public readonly timelines: GithubResponseCache<GithubTimelinePage>;
	public readonly commits: GithubResponseCache<GithubPullRequestCommitPage>;
	public readonly files: GithubResponseCache<GithubPullRequestFilePage>;
	/** One commit's diff — as large as a page of files, so as few entries. */
	public readonly commitDetails: GithubResponseCache<GithubCommitDetail>;
	public readonly reviewThreads: GithubResponseCache<GithubReviewThreadList>;
	public readonly statuses: GithubResponseCache<GithubPullRequestStatus>;
	public readonly contentEdits: GithubResponseCache<GithubContentEditHistory>;
	private readonly logger: Logger = new Logger(GithubPullRequestCache.name);

	public constructor(@Inject(GITHUB_CLOCK) clock: GithubClock) {
		const small: GithubResponseCacheOptions = {
			freshMs: GITHUB_PULL_REQUEST_CACHE_FRESH_MS,
			staleFallbackMs: GITHUB_STALE_FALLBACK_MS,
			maxEntries: GITHUB_PULL_REQUEST_CACHE_MAX_ENTRIES,
		};
		this.lists = new GithubResponseCache<GithubPullRequestPage>(small, clock, this.logger);
		this.details = new GithubResponseCache<GithubPullRequestDetail>(small, clock, this.logger);
		this.timelines = new GithubResponseCache<GithubTimelinePage>(small, clock, this.logger);
		this.commits = new GithubResponseCache<GithubPullRequestCommitPage>(small, clock, this.logger);
		this.files = new GithubResponseCache<GithubPullRequestFilePage>({ ...small, maxEntries: GITHUB_PULL_REQUEST_FILE_CACHE_MAX_ENTRIES }, clock, this.logger);
		this.commitDetails = new GithubResponseCache<GithubCommitDetail>({ ...small, maxEntries: GITHUB_PULL_REQUEST_FILE_CACHE_MAX_ENTRIES }, clock, this.logger);
		this.reviewThreads = new GithubResponseCache<GithubReviewThreadList>(small, clock, this.logger);
		this.statuses = new GithubResponseCache<GithubPullRequestStatus>(small, clock, this.logger);
		this.contentEdits = new GithubResponseCache<GithubContentEditHistory>(small, clock, this.logger);
	}

	/** The list key part for one filter, state and page. */
	public listKey(userId: string, ...parts: readonly string[]): string {
		return cacheKey(userId, LIST_PART, ...parts);
	}

	/** Everything cached for one user — their link changed, so their token did. */
	public invalidateUser(userId: string): void {
		const prefix = `${userId}${KEY_SEPARATOR}`;
		this.invalidateAll((key: string): boolean => key.startsWith(prefix));
	}

	/**
	 * Everything about one pull request, for every user, and every list (a list
	 * shows its title, state and update time). Comment edit histories are keyed
	 * by node id, not by pull request, so they are dropped too.
	 */
	public invalidatePullRequest(owner: string, repository: string, number: number): void {
		const pullRequest = `${KEY_SEPARATOR}${pullRequestKey(owner, repository, number)}${KEY_SEPARATOR}`;
		const list = `${KEY_SEPARATOR}${LIST_PART}${KEY_SEPARATOR}`;
		this.details.invalidate((key: string): boolean => key.includes(pullRequest));
		this.timelines.invalidate((key: string): boolean => key.includes(pullRequest));
		this.commits.invalidate((key: string): boolean => key.includes(pullRequest));
		this.files.invalidate((key: string): boolean => key.includes(pullRequest));
		this.commitDetails.invalidate((key: string): boolean => key.includes(pullRequest));
		this.reviewThreads.invalidate((key: string): boolean => key.includes(pullRequest));
		this.statuses.invalidate((key: string): boolean => key.includes(pullRequest));
		this.lists.invalidate((key: string): boolean => key.includes(list));
		this.contentEdits.invalidate((): boolean => true);
	}

	/** Everything about every pull request of one repository, for every user, and every list — a change GitHub did not tie to one pull request. */
	public invalidateRepository(owner: string, repository: string): void {
		const prefix = `${KEY_SEPARATOR}${`${owner}/${repository}#`.toLowerCase()}`;
		const list = `${KEY_SEPARATOR}${LIST_PART}${KEY_SEPARATOR}`;
		this.invalidateAll((key: string): boolean => key.includes(prefix) || key.includes(list));
	}

	private invalidateAll(matches: (key: string) => boolean): void {
		this.lists.invalidate(matches);
		this.details.invalidate(matches);
		this.timelines.invalidate(matches);
		this.commits.invalidate(matches);
		this.files.invalidate(matches);
		this.commitDetails.invalidate(matches);
		this.reviewThreads.invalidate(matches);
		this.statuses.invalidate(matches);
		this.contentEdits.invalidate(matches);
	}
}

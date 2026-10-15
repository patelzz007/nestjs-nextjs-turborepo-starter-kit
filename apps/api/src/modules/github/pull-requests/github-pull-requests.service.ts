// ============================================
// github-pull-requests.service.ts - Pull-request reads for the caller (ADR 052)
// ============================================
// Each read: the caller's own linked token, the per-user cache, GitHub, the
// mapper. The list's search is built here from a closed set of filters — no
// client-supplied text is ever part of what is sent to GitHub's search.

import { Inject, Injectable } from "@nestjs/common";
import {
	assertNever,
	type AddGithubPullRequestCommentInput,
	type GithubComment,
	type GithubCommitDetail,
	type GithubContentEditHistory,
	type GithubPullRequestCommitPage,
	type GithubPullRequestDetail,
	type GithubPullRequestFilePage,
	type GithubPullRequestFilter,
	type GithubPullRequestListQuery,
	type GithubPullRequestPage,
	type GithubPullRequestParams,
	type GithubPullRequestCommitParams,
	type GithubPullRequestStateFilter,
	type GithubPullRequestStatus,
	type GithubReview,
	type GithubReviewThreadList,
	type GithubTimelinePage,
	type SubmitGithubPullRequestReviewInput,
	type GithubReactionState,
	type GithubMergeResult,
	type MergeGithubPullRequestInput,
	GITHUB_TIMELINE_EVENT_DETAIL_MAX_LENGTH,
	type SetGithubReactionInput,
} from "@workspace/shared";

import { GITHUB_CLOCK } from "../github-contributions.service";
import type { GithubClock } from "../github-response.cache";
import { toCommitDetail } from "../github.mappers";

import { GithubWriteRejectedError } from "../github.errors";
import { GithubCommentPicturesService } from "./github-comment-pictures.service";
import { GithubPictureAddresses } from "./github-picture-addresses";
import { GithubCredentialsService } from "./github-credentials.service";
import { cacheKey, GithubPullRequestCache, pullRequestKey } from "./github-pull-request.cache";
import { GithubPullRequestClient } from "./github-pull-request.client";
import {
	toContentEditHistory,
	toPullRequestCommitPage,
	toPullRequestDetail,
	toPullRequestFilePage,
	toPullRequestPage,
	toChecks,
	toMergeability,
	toMergeOptions,
	toPostedComment,
	toReviewThreadList,
	toSubmittedReview,
	toTimelinePage,
} from "./github-pull-requests.mappers";

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

/** A cache key part for "no cursor" (the first page). */
const FIRST_PAGE = "";

@Injectable()
export class GithubPullRequestsService {
	public constructor(
		private readonly credentials: GithubCredentialsService,
		private readonly client: GithubPullRequestClient,
		private readonly cache: GithubPullRequestCache,
		@Inject(GITHUB_CLOCK) private readonly clock: GithubClock,
		private readonly pictureAddresses: GithubPictureAddresses,
		private readonly pictures: GithubCommentPicturesService,
	) {}

	public async list(userId: string, query: GithubPullRequestListQuery): Promise<GithubPullRequestPage> {
		return this.credentials.withCredential(userId, ({ credential, login }) =>
			this.cache.lists.read(this.cache.listKey(userId, query.filter, query.state, query.cursor ?? FIRST_PAGE), async () =>
				toPullRequestPage(await this.client.searchPullRequests(credential, buildPullRequestSearch(query.filter, query.state, login), query.cursor ?? null)),
			),
		);
	}

	public async detail(userId: string, params: GithubPullRequestParams): Promise<GithubPullRequestDetail> {
		return this.credentials.withCredential(userId, ({ credential }) =>
			this.cache.details.read(this.pullRequestCacheKey(userId, params, "detail"), async () =>
				toPullRequestDetail(await this.client.fetchPullRequest(credential, params), this.pictureAddresses.linkFor),
			),
		);
	}

	public async timeline(userId: string, params: GithubPullRequestParams, cursor: string | undefined): Promise<GithubTimelinePage> {
		return this.credentials.withCredential(userId, ({ credential }) =>
			this.cache.timelines.read(this.pullRequestCacheKey(userId, params, "timeline", cursor ?? FIRST_PAGE), async () =>
				toTimelinePage(await this.client.fetchTimeline(credential, params, cursor ?? null), this.pictureAddresses.linkFor),
			),
		);
	}

	public async commits(userId: string, params: GithubPullRequestParams, cursor: string | undefined): Promise<GithubPullRequestCommitPage> {
		return this.credentials.withCredential(userId, ({ credential }) =>
			this.cache.commits.read(this.pullRequestCacheKey(userId, params, "commits", cursor ?? FIRST_PAGE), async () =>
				toPullRequestCommitPage(await this.client.fetchCommits(credential, params, cursor ?? null)),
			),
		);
	}

	/** One page of changed files with the head commit they belong to (read together, so a line comment targets the diff shown). */
	public async files(userId: string, params: GithubPullRequestParams, page: number): Promise<GithubPullRequestFilePage> {
		return this.credentials.withCredential(userId, ({ credential }) =>
			this.cache.files.read(this.pullRequestCacheKey(userId, params, "files", String(page)), async () => {
				const [result, headSha] = await Promise.all([this.client.fetchFiles(credential, params, page), this.client.fetchHeadSha(credential, params)]);
				return toPullRequestFilePage(result, page, headSha);
			}),
		);
	}

	/** One of the pull request's commits with its diff, read with the caller's token (any repository it can see, not only configured ones). */
	public async commit(userId: string, params: GithubPullRequestCommitParams): Promise<GithubCommitDetail> {
		return this.credentials.withCredential(userId, ({ credential }) =>
			this.cache.commitDetails.read(this.pullRequestCacheKey(userId, params, "commit", params.sha.toLowerCase()), async () =>
				toCommitDetail(await this.client.fetchCommit(credential, params)),
			),
		);
	}

	/**
	 * Comments on the conversation as the caller's GitHub account, committing
	 * the pictures attached from the app it links first. Never cached
	 * or retried here (a retry is the client's, with its Idempotency-Key); every
	 * cached view of the pull request is dropped so the next read shows it.
	 */
	public async addComment(userId: string, params: GithubPullRequestParams, input: AddGithubPullRequestCommentInput): Promise<GithubComment> {
		const comment = await this.credentials.withCredential(userId, async ({ credential }) => {
			await this.pictures.commitLinkedPictures(credential, userId, params, input.body);
			return toPostedComment(await this.client.addComment(credential, params, input.body));
		});
		this.cache.invalidatePullRequest(params.owner, params.repository, params.number);
		return comment;
	}

	/** Submits a review as the caller's GitHub account (its linked pictures committed first) — GitHub enforces who may approve; then drops the cached views. */
	public async submitReview(userId: string, params: GithubPullRequestParams, input: SubmitGithubPullRequestReviewInput): Promise<GithubReview> {
		const review = await this.credentials.withCredential(userId, async ({ credential }) => {
			await this.pictures.commitLinkedPictures(credential, userId, params, input.body);
			return toSubmittedReview(await this.client.submitReview(credential, params, input.event, input.body), this.clock.nowEpochMs());
		});
		this.cache.invalidatePullRequest(params.owner, params.repository, params.number);
		return review;
	}

	/**
	 * Sets the caller's reaction on or off on GitHub, as their account; setting
	 * it to what it already is changes nothing, so no Idempotency-Key is needed.
	 * Drops the cached views so the next read shows it.
	 */
	public async setReaction(userId: string, params: GithubPullRequestParams, input: SetGithubReactionInput): Promise<GithubReactionState> {
		await this.credentials.withCredential(userId, ({ credential, login }) => this.client.setReaction(credential, login, params, input.subject, input.content, input.reacted));
		this.cache.invalidatePullRequest(params.owner, params.repository, params.number);
		return { subject: input.subject, content: input.content, reacted: input.reacted };
	}

	/**
	 * Merges as the caller's account, pinned to the head commit they saw (GitHub refuses when it moved
	 * on), then — when asked, and the branch is this repository's — deletes the branch. The deletion
	 * never undoes the merge: a failure is reported with GitHub's reason. Drops every cached view.
	 */
	public async merge(userId: string, params: GithubPullRequestParams, input: MergeGithubPullRequestInput): Promise<GithubMergeResult> {
		const result = await this.credentials.withCredential(userId, async ({ credential }): Promise<GithubMergeResult> => {
			const sha = await this.client.merge(credential, params, { method: input.method, sha: input.expectedHeadSha, title: input.commitTitle, message: input.commitMessage });
			if (!input.deleteBranch) {
				return { sha, branch: { outcome: "kept" } };
			}
			const state = await this.client.fetchMergeState(credential, params);
			if (state.pullRequest.isCrossRepository) {
				return { sha, branch: { outcome: "kept" } };
			}
			try {
				await this.client.deleteBranch(credential, params, state.pullRequest.headRefName);
				return { sha, branch: { outcome: "deleted" } };
			} catch (error: unknown) {
				if (error instanceof GithubWriteRejectedError) {
					return { sha, branch: { outcome: "failed", reason: error.message.slice(0, GITHUB_TIMELINE_EVENT_DETAIL_MAX_LENGTH) } };
				}
				throw error;
			}
		});
		this.cache.invalidatePullRequest(params.owner, params.repository, params.number);
		return result;
	}

	/** GitHub's merge box: the head commit's checks and whether the branch merges cleanly, read together. */
	public async status(userId: string, params: GithubPullRequestParams): Promise<GithubPullRequestStatus> {
		return this.credentials.withCredential(userId, ({ credential }) =>
			this.cache.statuses.read(this.pullRequestCacheKey(userId, params, "status"), async () => {
				const [rollup, mergeState] = await Promise.all([this.client.fetchChecks(credential, params), this.client.fetchMergeState(credential, params)]);
				return { checks: toChecks(rollup), mergeability: toMergeability(mergeState.pullRequest.mergeable), merge: toMergeOptions(mergeState) };
			}),
		);
	}

	public async reviewThreads(userId: string, params: GithubPullRequestParams): Promise<GithubReviewThreadList> {
		return this.credentials.withCredential(userId, ({ credential }) =>
			this.cache.reviewThreads.read(this.pullRequestCacheKey(userId, params, "review-threads"), async () =>
				toReviewThreadList(await this.client.fetchReviewThreads(credential, params), this.pictureAddresses.linkFor),
			),
		);
	}

	public async contentEdits(userId: string, nodeId: string): Promise<GithubContentEditHistory> {
		return this.credentials.withCredential(userId, ({ credential }) =>
			this.cache.contentEdits.read(cacheKey(userId, "edits", nodeId), async () => toContentEditHistory(await this.client.fetchContentEdits(credential, nodeId))),
		);
	}

	private pullRequestCacheKey(userId: string, params: GithubPullRequestParams, ...view: readonly string[]): string {
		return cacheKey(userId, pullRequestKey(params.owner, params.repository, params.number), ...view);
	}
}

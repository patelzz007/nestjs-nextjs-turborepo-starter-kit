// ============================================
// github-pull-request-reads.adapter.ts - Pull-request reads for the caller (ADR 052)
// ============================================
// Each read: the per-user cache, GitHub with the caller's own token, then the
// mapper from GitHub's wire shapes into our contract — the anti-corruption
// layer: nothing GitHub-shaped leaves this adapter.

import { Inject, Injectable } from "@nestjs/common";
import type {
	GithubCommitDetail,
	GithubContentEditHistory,
	GithubPullRequestCommitPage,
	GithubPullRequestCommitParams,
	GithubPullRequestDetail,
	GithubPullRequestFilePage,
	GithubPullRequestListQuery,
	GithubPullRequestPage,
	GithubPullRequestParams,
	GithubPullRequestStatus,
	GithubReviewThreadList,
	GithubTimelinePage,
} from "@workspace/shared";

import type { LinkedGithubCredential } from "../../application/ports/github-credentials.port";
import type { GithubPullRequestReadsPort } from "../../application/ports/github-pull-requests.port";
import { buildPullRequestSearch } from "../../domain/policies/pull-request-search.policy";
import { toCommitDetail } from "../github-api/github.mappers";
import { GithubPictureAddresses } from "../github-api/github-picture-addresses";
import { cacheKey, GithubPullRequestCache, pullRequestKey } from "../github-api/github-pull-request.cache";
import { GithubPullRequestClient } from "../github-api/github-pull-request.client";
import {
	toChecks,
	toContentEditHistory,
	toMergeability,
	toMergeOptions,
	toPullRequestCommitPage,
	toPullRequestDetail,
	toPullRequestFilePage,
	toPullRequestPage,
	toReviewThreadList,
	toTimelinePage,
} from "../github-api/github-pull-requests.mappers";
import { linkedTransportCredential } from "./linked-credential";

/** A cache key part for "no cursor" (the first page). */
const FIRST_PAGE = "";

@Injectable()
export class GithubPullRequestReadsAdapter implements GithubPullRequestReadsPort {
	public constructor(
		private readonly client: GithubPullRequestClient,
		@Inject(GithubPullRequestCache) private readonly cache: GithubPullRequestCache,
		private readonly pictureAddresses: GithubPictureAddresses,
	) {}

	public async list(userId: string, linked: LinkedGithubCredential, query: GithubPullRequestListQuery): Promise<GithubPullRequestPage> {
		const credential = linkedTransportCredential(linked);
		return this.cache.lists.read(this.cache.listKey(userId, query.filter, query.state, query.cursor ?? FIRST_PAGE), async () =>
			toPullRequestPage(await this.client.searchPullRequests(credential, buildPullRequestSearch(query.filter, query.state, linked.login), query.cursor ?? null)),
		);
	}

	public async detail(userId: string, linked: LinkedGithubCredential, params: GithubPullRequestParams): Promise<GithubPullRequestDetail> {
		return this.cache.details.read(this.pullRequestCacheKey(userId, params, "detail"), async () =>
			toPullRequestDetail(await this.client.fetchPullRequest(linkedTransportCredential(linked), params), this.pictureAddresses.linkFor),
		);
	}

	public async timeline(userId: string, linked: LinkedGithubCredential, params: GithubPullRequestParams, cursor: string | undefined): Promise<GithubTimelinePage> {
		return this.cache.timelines.read(this.pullRequestCacheKey(userId, params, "timeline", cursor ?? FIRST_PAGE), async () =>
			toTimelinePage(await this.client.fetchTimeline(linkedTransportCredential(linked), params, cursor ?? null), this.pictureAddresses.linkFor),
		);
	}

	public async commits(userId: string, linked: LinkedGithubCredential, params: GithubPullRequestParams, cursor: string | undefined): Promise<GithubPullRequestCommitPage> {
		return this.cache.commits.read(this.pullRequestCacheKey(userId, params, "commits", cursor ?? FIRST_PAGE), async () =>
			toPullRequestCommitPage(await this.client.fetchCommits(linkedTransportCredential(linked), params, cursor ?? null)),
		);
	}

	/** One page of changed files with the head commit they belong to (read together, so a line comment targets the diff shown). */
	public async files(userId: string, linked: LinkedGithubCredential, params: GithubPullRequestParams, page: number): Promise<GithubPullRequestFilePage> {
		const credential = linkedTransportCredential(linked);
		return this.cache.files.read(this.pullRequestCacheKey(userId, params, "files", String(page)), async () => {
			const [result, headSha] = await Promise.all([this.client.fetchFiles(credential, params, page), this.client.fetchHeadSha(credential, params)]);
			return toPullRequestFilePage(result, page, headSha);
		});
	}

	/** One of the pull request's commits with its diff, read with the caller's token (any repository it can see, not only configured ones). */
	public async commit(userId: string, linked: LinkedGithubCredential, params: GithubPullRequestCommitParams): Promise<GithubCommitDetail> {
		return this.cache.commitDetails.read(this.pullRequestCacheKey(userId, params, "commit", params.sha.toLowerCase()), async () =>
			toCommitDetail(await this.client.fetchCommit(linkedTransportCredential(linked), params)),
		);
	}

	/** GitHub's merge box: the head commit's checks and whether the branch merges cleanly, read together. */
	public async status(userId: string, linked: LinkedGithubCredential, params: GithubPullRequestParams): Promise<GithubPullRequestStatus> {
		const credential = linkedTransportCredential(linked);
		return this.cache.statuses.read(this.pullRequestCacheKey(userId, params, "status"), async () => {
			const [rollup, mergeState] = await Promise.all([this.client.fetchChecks(credential, params), this.client.fetchMergeState(credential, params)]);
			return { checks: toChecks(rollup), mergeability: toMergeability(mergeState.pullRequest.mergeable), merge: toMergeOptions(mergeState) };
		});
	}

	public async reviewThreads(userId: string, linked: LinkedGithubCredential, params: GithubPullRequestParams): Promise<GithubReviewThreadList> {
		return this.cache.reviewThreads.read(this.pullRequestCacheKey(userId, params, "review-threads"), async () =>
			toReviewThreadList(await this.client.fetchReviewThreads(linkedTransportCredential(linked), params), this.pictureAddresses.linkFor),
		);
	}

	public async contentEdits(userId: string, linked: LinkedGithubCredential, nodeId: string): Promise<GithubContentEditHistory> {
		return this.cache.contentEdits.read(cacheKey(userId, "edits", nodeId), async () =>
			toContentEditHistory(await this.client.fetchContentEdits(linkedTransportCredential(linked), nodeId)),
		);
	}

	private pullRequestCacheKey(userId: string, params: GithubPullRequestParams, ...view: readonly string[]): string {
		return cacheKey(userId, pullRequestKey(params.owner, params.repository, params.number), ...view);
	}
}

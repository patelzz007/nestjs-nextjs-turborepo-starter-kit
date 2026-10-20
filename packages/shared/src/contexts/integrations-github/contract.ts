// API contract leaves owned by the `integrations-github` context (plan §7: the backend owner of each
// endpoint). Composed into `apiContract` (`src/contracts/index.ts`) with identical keys.

import { z } from "zod";

import { defineContract } from "../../contracts/define-contract";
import { singleResponse } from "../../contracts/response";
import { githubPullRequestsRoutes, githubRoutes } from "./routes";
import {
	GithubCommitDetailSchema,
	GithubCommitHistoryInputSchema,
	GithubCommitPageSchema,
	GithubCommitParamsSchema,
	GithubContributorStatsSchema,
	GithubRepositoryListSchema,
	GithubRepositoryParamsSchema,
	GithubRepositorySummarySchema,
} from "./schemas/github-contributions";
import { GithubLiveUpdatesParamsSchema, GithubLiveUpdatesStatusSchema } from "./schemas/github-live-updates";
import {
	AddGithubPullRequestCommentInputSchema,
	AttachGithubCommentPictureInputSchema,
	GithubAccountStatusSchema,
	GithubCommentPictureSchema,
	GithubCommentSchema,
	GithubContentEditHistorySchema,
	GithubContentEditParamsSchema,
	GithubMergeResultSchema,
	GithubPullRequestCommitPageSchema,
	GithubPullRequestCommitParamsSchema,
	GithubPullRequestCursorInputSchema,
	GithubPullRequestDetailSchema,
	GithubPullRequestFilePageSchema,
	GithubPullRequestFilesInputSchema,
	GithubPullRequestListQuerySchema,
	GithubPullRequestPageSchema,
	GithubPullRequestParamsSchema,
	GithubPullRequestStatusSchema,
	GithubReviewSchema,
	GithubReviewThreadListSchema,
	GithubTimelinePageSchema,
	LinkGithubAccountSchema,
	MergeGithubPullRequestInputSchema,
	SetGithubReactionInputSchema,
	SubmitGithubPullRequestReviewInputSchema,
} from "./schemas/github-pull-requests";
import { GithubReactionStateSchema } from "./schemas/github-reactions";

// ── GitHub contributions ───────────────────────────────────────────
// Read-only views of the repositories the API may read: pinned by
// `GITHUB_REPOSITORIES`, or discovered from the token's account when that is
// empty. Any other repository is a 404.

/** Contract leaves composed into `apiContract.github`. */
export const githubContract = {
	/** The repositories the API may read (pinned or discovered) — empty when the integration is off. */
	repositories: defineContract({ method: "GET", path: githubRoutes.repositories, input: z.undefined(), response: singleResponse(GithubRepositoryListSchema) }),
	/** Stars, forks, languages, commit count and last push of one configured repository. */
	repositorySummary: defineContract({
		method: "GET",
		path: githubRoutes.repositorySummary,
		input: GithubRepositoryParamsSchema,
		response: singleResponse(GithubRepositorySummarySchema),
	}),
	/** One page of the default branch's history, newest first, with lines added/deleted per commit. */
	repositoryCommits: defineContract({
		method: "GET",
		path: githubRoutes.repositoryCommits,
		input: GithubCommitHistoryInputSchema,
		response: singleResponse(GithubCommitPageSchema),
	}),
	/** One commit of a listed repository: its whole message, parents and every changed file with its diff. */
	repositoryCommit: defineContract({
		method: "GET",
		path: githubRoutes.repositoryCommit,
		input: GithubCommitParamsSchema,
		response: singleResponse(GithubCommitDetailSchema),
	}),
	/** Commits and lines added/deleted per contributor — `computing` while GitHub prepares the statistics. */
	repositoryContributors: defineContract({
		method: "GET",
		path: githubRoutes.repositoryContributors,
		input: GithubRepositoryParamsSchema,
		response: singleResponse(GithubContributorStatsSchema),
	}),
};

// ── GitHub pull requests (admins, each with their own linked token — ADR 052) ──

/** Contract leaves composed into `apiContract.githubPullRequests`. */
export const githubPullRequestsContract = {
	/** The caller's link: `off` (not configured), `unlinked`, or the linked account — never the token. */
	account: defineContract({ method: "GET", path: githubPullRequestsRoutes.account, input: z.undefined(), response: singleResponse(GithubAccountStatusSchema) }),
	/** Link (or replace) the caller's own fine-grained token — checked with GitHub before it is stored. */
	linkAccount: defineContract({
		method: "PUT",
		path: githubPullRequestsRoutes.account,
		input: LinkGithubAccountSchema,
		response: singleResponse(GithubAccountStatusSchema),
	}),
	/** Forget the caller's token. */
	unlinkAccount: defineContract({ method: "DELETE", path: githubPullRequestsRoutes.account, input: z.undefined(), response: singleResponse(GithubAccountStatusSchema) }),
	/** One page of pull requests for a filter (yours, created, review requests, assigned, mentions) and state. */
	list: defineContract({
		method: "GET",
		path: githubPullRequestsRoutes.list,
		input: GithubPullRequestListQuerySchema,
		response: singleResponse(GithubPullRequestPageSchema),
	}),
	/** One pull request with the first page of its conversation. */
	detail: defineContract({
		method: "GET",
		path: githubPullRequestsRoutes.detail,
		input: GithubPullRequestParamsSchema,
		response: singleResponse(GithubPullRequestDetailSchema),
	}),
	/** The next page of a pull request's conversation. */
	timeline: defineContract({
		method: "GET",
		path: githubPullRequestsRoutes.timeline,
		input: GithubPullRequestCursorInputSchema,
		response: singleResponse(GithubTimelinePageSchema),
	}),
	/** A pull request's commits, oldest first. */
	commits: defineContract({
		method: "GET",
		path: githubPullRequestsRoutes.commits,
		input: GithubPullRequestCursorInputSchema,
		response: singleResponse(GithubPullRequestCommitPageSchema),
	}),
	/** One of the pull request's commits with its changed files and diffs, read with the caller's own token. */
	commit: defineContract({
		method: "GET",
		path: githubPullRequestsRoutes.commit,
		input: GithubPullRequestCommitParamsSchema,
		response: singleResponse(GithubCommitDetailSchema),
	}),
	/** GitHub's merge box, read live: the head commit's checks and whether the branch merges cleanly. */
	status: defineContract({
		method: "GET",
		path: githubPullRequestsRoutes.status,
		input: GithubPullRequestParamsSchema,
		response: singleResponse(GithubPullRequestStatusSchema),
	}),
	/** Comment on the conversation — posted to GitHub as the linked account. Send an Idempotency-Key. */
	addComment: defineContract({
		method: "POST",
		path: githubPullRequestsRoutes.comments,
		input: AddGithubPullRequestCommentInputSchema,
		response: singleResponse(GithubCommentSchema),
	}),
	/** Submit a review (comment, approve or request changes) — posted to GitHub as the linked account. Send an Idempotency-Key. */
	submitReview: defineContract({
		method: "POST",
		path: githubPullRequestsRoutes.reviews,
		input: SubmitGithubPullRequestReviewInputSchema,
		response: singleResponse(GithubReviewSchema),
	}),
	/**
	 * Set the linked account's emoji reaction on the pull request, a comment or a line comment, on or
	 * off — on GitHub, as the linked account. Setting it to what it already is changes nothing, so a
	 * retry is safe without an Idempotency-Key.
	 */
	setReaction: defineContract({
		method: "PUT",
		path: githubPullRequestsRoutes.reactions,
		input: SetGithubReactionInputSchema,
		response: singleResponse(GithubReactionStateSchema),
	}),
	/**
	 * Commit a picture the caller uploaded (`GITHUB_COMMENT_IMAGE`, READY) to the repository's
	 * comment-assets branch, as the linked account, and answer the address to link it by. The
	 * uploaded copy is then deleted. Send an Idempotency-Key.
	 */
	attachPicture: defineContract({
		method: "POST",
		path: githubPullRequestsRoutes.pictures,
		input: AttachGithubCommentPictureInputSchema,
		response: singleResponse(GithubCommentPictureSchema),
	}),
	/**
	 * Merge the pull request on GitHub as the linked account (merge commit, squash or rebase), pinned to
	 * the head commit that was read; optionally delete its branch afterwards. Send an Idempotency-Key.
	 */
	merge: defineContract({
		method: "POST",
		path: githubPullRequestsRoutes.merge,
		input: MergeGithubPullRequestInputSchema,
		response: singleResponse(GithubMergeResultSchema),
	}),
	/** Whether a repository's pull requests update live (`off` when this server receives no webhooks). */
	liveUpdates: defineContract({
		method: "GET",
		path: githubPullRequestsRoutes.liveUpdates,
		input: GithubLiveUpdatesParamsSchema,
		response: singleResponse(GithubLiveUpdatesStatusSchema),
	}),
	/**
	 * Turn a repository's live updates on: the API registers a webhook there with the linked token
	 * (it needs "Webhooks: Read and write"). Turning them on again changes nothing.
	 */
	enableLiveUpdates: defineContract({
		method: "PUT",
		path: githubPullRequestsRoutes.liveUpdates,
		input: GithubLiveUpdatesParamsSchema,
		response: singleResponse(GithubLiveUpdatesStatusSchema),
	}),
	/** Turn a repository's live updates off: its webhook is deleted on GitHub. Turning them off again changes nothing. */
	disableLiveUpdates: defineContract({
		method: "DELETE",
		path: githubPullRequestsRoutes.liveUpdates,
		input: GithubLiveUpdatesParamsSchema,
		response: singleResponse(GithubLiveUpdatesStatusSchema),
	}),
	/** One page of a pull request's changed files with their diffs. */
	files: defineContract({
		method: "GET",
		path: githubPullRequestsRoutes.files,
		input: GithubPullRequestFilesInputSchema,
		response: singleResponse(GithubPullRequestFilePageSchema),
	}),
	/** The conversations on lines of the diff. */
	reviewThreads: defineContract({
		method: "GET",
		path: githubPullRequestsRoutes.reviewThreads,
		input: GithubPullRequestParamsSchema,
		response: singleResponse(GithubReviewThreadListSchema),
	}),
	/** Every saved version of a comment, review or description, newest first. */
	contentEdits: defineContract({
		method: "GET",
		path: githubPullRequestsRoutes.contentEdits,
		input: GithubContentEditParamsSchema,
		response: singleResponse(GithubContentEditHistorySchema),
	}),
};

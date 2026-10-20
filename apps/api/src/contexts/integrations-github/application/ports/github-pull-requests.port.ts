import type {
	GithubComment,
	GithubCommitDetail,
	GithubContentEditHistory,
	GithubMergeMethod,
	GithubPullRequestCommitPage,
	GithubPullRequestCommitParams,
	GithubPullRequestDetail,
	GithubPullRequestFilePage,
	GithubPullRequestListQuery,
	GithubPullRequestPage,
	GithubPullRequestParams,
	GithubPullRequestStatus,
	GithubReactionContent,
	GithubReactionSubject,
	GithubReview,
	GithubReviewEvent,
	GithubReviewThreadList,
	GithubTimelinePage,
} from "@workspace/shared";

import type { LinkedGithubCredential } from "./github-credentials.port";

/**
 * Pull-request reads with the caller's own token, answered in our contract
 * (GitHub's wire shapes never leave the adapter) and cached per user.
 */
export interface GithubPullRequestReadsPort {
	list(userId: string, linked: LinkedGithubCredential, query: GithubPullRequestListQuery): Promise<GithubPullRequestPage>;
	detail(userId: string, linked: LinkedGithubCredential, params: GithubPullRequestParams): Promise<GithubPullRequestDetail>;
	timeline(userId: string, linked: LinkedGithubCredential, params: GithubPullRequestParams, cursor: string | undefined): Promise<GithubTimelinePage>;
	commits(userId: string, linked: LinkedGithubCredential, params: GithubPullRequestParams, cursor: string | undefined): Promise<GithubPullRequestCommitPage>;
	files(userId: string, linked: LinkedGithubCredential, params: GithubPullRequestParams, page: number): Promise<GithubPullRequestFilePage>;
	commit(userId: string, linked: LinkedGithubCredential, params: GithubPullRequestCommitParams): Promise<GithubCommitDetail>;
	status(userId: string, linked: LinkedGithubCredential, params: GithubPullRequestParams): Promise<GithubPullRequestStatus>;
	reviewThreads(userId: string, linked: LinkedGithubCredential, params: GithubPullRequestParams): Promise<GithubReviewThreadList>;
	contentEdits(userId: string, linked: LinkedGithubCredential, nodeId: string): Promise<GithubContentEditHistory>;
}

/** What a merge asks GitHub for. */
export interface GithubMergeRequest {
	readonly method: GithubMergeMethod;
	/** The head commit the caller saw; GitHub refuses when it moved on. */
	readonly sha: string;
	readonly title: string;
	readonly message: string;
}

/** The pull request's head branch, as a merge needs it. */
export interface GithubHeadBranch {
	readonly isCrossRepository: boolean;
	readonly headRefName: string;
}

/** Pull-request writes as the caller's GitHub account. Refusals surface as `GithubWriteRejectedError`. */
export interface GithubPullRequestWritesPort {
	addComment(linked: LinkedGithubCredential, params: GithubPullRequestParams, body: string): Promise<GithubComment>;
	submitReview(linked: LinkedGithubCredential, params: GithubPullRequestParams, event: GithubReviewEvent, body: string): Promise<GithubReview>;
	setReaction(
		linked: LinkedGithubCredential,
		params: GithubPullRequestParams,
		subject: GithubReactionSubject,
		content: GithubReactionContent,
		reacted: boolean,
	): Promise<void>;
	/** The merge commit's SHA. */
	merge(linked: LinkedGithubCredential, params: GithubPullRequestParams, merge: GithubMergeRequest): Promise<string>;
	headBranch(linked: LinkedGithubCredential, params: GithubPullRequestParams): Promise<GithubHeadBranch>;
	deleteBranch(linked: LinkedGithubCredential, params: GithubPullRequestParams, branch: string): Promise<void>;
}

// Minimal answers in our own contract, parsed with the shared schemas so every
// fixture is a value the API could really answer with.

import {
	GithubCommentSchema,
	GithubCommitDetailSchema,
	GithubContentEditHistorySchema,
	GithubPullRequestCommitPageSchema,
	GithubPullRequestDetailSchema,
	GithubPullRequestFilePageSchema,
	GithubPullRequestPageSchema,
	GithubPullRequestStatusSchema,
	GithubReviewSchema,
	GithubReviewThreadListSchema,
	GithubTimelinePageSchema,
	type GithubComment,
	type GithubCommitDetail,
	type GithubContentEditHistory,
	type GithubPullRequestCommitPage,
	type GithubPullRequestDetail,
	type GithubPullRequestFilePage,
	type GithubPullRequestPage,
	type GithubPullRequestParams,
	type GithubPullRequestStatus,
	type GithubReview,
	type GithubReviewThreadList,
	type GithubTimelinePage,
} from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export const USER_ID = "11111111-1111-4111-8111-111111111111";
export const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
export const HEAD_SHA = "a".repeat(40);
export const MERGE_SHA = "b".repeat(40);
export const AT = 1_790_812_800_000;
export const PULL_REQUEST: GithubPullRequestParams = { owner: "octo-org", repository: "hello-world", number: 42 };
export const REPOSITORY = { owner: "octo-org", repository: "hello-world" };

/** A signed-in admin, as `@CurrentActor()` builds one. */
export function userActor(userId: string = USER_ID): ActorContext {
	return {
		kind: "user",
		userId,
		sessionId: "session-1",
		tenantId: null,
		isSuperAdmin: false,
		accessScope: "tenant",
		impersonatorUserId: null,
		request: { requestId: "req-1", ip: "203.0.113.24", userAgent: "vitest", deviceLabel: null, endpoint: "/api/v1/github" },
	};
}

/** GitHub's webhook has no session. */
export function anonymousActor(): ActorContext {
	return {
		kind: "anonymous",
		tenantId: null,
		request: { requestId: "req-2", ip: "140.82.112.1", userAgent: "GitHub-Hookshot", deviceLabel: null, endpoint: "/api/v1/github/webhook" },
	};
}

const AUTHOR = { login: "octocat", avatarUrl: null };
const HTML_URL = "https://github.com/octo-org/hello-world/pull/42";

export const PULL_REQUEST_PAGE: GithubPullRequestPage = GithubPullRequestPageSchema.parse({ items: [], nextCursor: null, totalCount: 0 });
export const TIMELINE_PAGE: GithubTimelinePage = GithubTimelinePageSchema.parse({ items: [], nextCursor: "Y3Vyc29y" });
export const COMMIT_PAGE: GithubPullRequestCommitPage = GithubPullRequestCommitPageSchema.parse({ items: [], nextCursor: null, totalCount: 0 });
export const FILE_PAGE: GithubPullRequestFilePage = GithubPullRequestFilePageSchema.parse({ files: [], nextPage: null, headSha: HEAD_SHA });
export const REVIEW_THREADS: GithubReviewThreadList = GithubReviewThreadListSchema.parse({ threads: [], truncated: false });
export const CONTENT_EDITS: GithubContentEditHistory = GithubContentEditHistorySchema.parse({ edits: [], totalCount: 0 });

export const PULL_REQUEST_DETAIL: GithubPullRequestDetail = GithubPullRequestDetailSchema.parse({
	...PULL_REQUEST,
	title: "Add the parser",
	state: "open",
	isDraft: false,
	author: AUTHOR,
	createdAt: AT,
	updatedAt: AT,
	commentCount: 0,
	reviewDecision: null,
	labels: [],
	htmlUrl: HTML_URL,
	id: "PR_kwDOAbCdEf",
	body: "",
	bodyImages: [],
	reactions: [],
	bodyLastEditedAt: null,
	baseRef: "main",
	headRef: "feature/parser",
	headOwner: null,
	additions: 1,
	deletions: 0,
	changedFiles: 1,
	commitCount: 1,
	requestedReviewers: [],
	mergedAt: null,
	closedAt: null,
	viewerDidAuthor: false,
	viewerCanUpdate: true,
	timeline: TIMELINE_PAGE,
});

export const PULL_REQUEST_STATUS: GithubPullRequestStatus = GithubPullRequestStatusSchema.parse({
	checks: { kind: "none" },
	mergeability: "mergeable",
	merge: {
		headSha: HEAD_SHA,
		state: "clean",
		methods: ["merge"],
		defaultMethod: "merge",
		headBranch: "feature/parser",
		canDeleteHeadBranch: true,
		deletesBranchOnMerge: false,
	},
});

export const COMMIT_DETAIL: GithubCommitDetail = GithubCommitDetailSchema.parse({
	sha: HEAD_SHA,
	shortSha: HEAD_SHA.slice(0, 7),
	headline: "Add the parser",
	htmlUrl: `https://github.com/octo-org/hello-world/commit/${HEAD_SHA}`,
	committedAt: AT,
	author: { name: "Octo Cat", login: "octocat", avatarUrl: null },
	additions: 1,
	deletions: 0,
	changedFiles: 0,
	message: "Add the parser",
	parents: [],
	files: [],
	filesTruncated: false,
});

const COMMENT_FIELDS = {
	id: "IC_kwDOAbCdEf",
	author: AUTHOR,
	body: "Looks good",
	images: [],
	reactions: [],
	reactionSubject: null,
	createdAt: AT,
	lastEditedAt: null,
	viewerCanUpdate: true,
	viewerDidAuthor: true,
	htmlUrl: `${HTML_URL}#issuecomment-1`,
};

export const POSTED_COMMENT: GithubComment = GithubCommentSchema.parse(COMMENT_FIELDS);

export const SUBMITTED_REVIEW: GithubReview = GithubReviewSchema.parse({
	...COMMENT_FIELDS,
	id: "PRR_kwDOAbCdEf",
	state: "approved",
	submittedAt: AT,
	comments: [],
	commentCount: 0,
});

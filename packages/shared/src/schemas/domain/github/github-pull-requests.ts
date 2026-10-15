// ============================================
// github-pull-requests.ts - GitHub pull requests with an admin's own token (ADR 052)
// ============================================
// An admin links their own fine-grained GitHub token; every read here is made
// with it, so GitHub decides what each admin may see — private repositories
// included. Nothing about a pull request is stored: the API reads GitHub and
// answers these shapes. The list is searched from a closed set of filters; no
// client-supplied search text ever reaches GitHub.

import { z } from "zod";

import { EpochMsSchema } from "../../api/common";
import {
	GithubAccountLoginSchema,
	GithubCommitFileSchema,
	GithubCommitSchema,
	GithubCommitShaSchema,
	GithubOwnerSchema,
	GithubRepositoryNameSchema,
	GITHUB_COMMIT_FILES_MAX,
	GITHUB_FILE_PATH_MAX_LENGTH,
} from "./github-contributions";
import { GithubBodyImagesSchema } from "./github-body-images";
import { GithubReactionGroupsSchema, GithubReactionSubjectSchema, SetGithubReactionSchema } from "./github-reactions";

// ── Error codes the apps act on ────────────────────────────────────────────

/** Machine codes of the pull-request failures a client answers with its own UI (link a token, set up the server). */
export const GITHUB_PULL_REQUEST_ERROR_CODES = {
	/** 409 — no token linked yet: offer to link one. */
	accountNotLinked: "GITHUB_ACCOUNT_NOT_LINKED",
	/** 409 — GitHub stopped accepting the linked token: offer to link a new one. */
	tokenRejected: "GITHUB_TOKEN_REJECTED",
	/** 400 — GitHub refused the token being linked. */
	tokenInvalid: "GITHUB_TOKEN_INVALID",
	/** 409 — GitHub refused the comment or review (an author approving their own pull request, a locked conversation): GitHub's reason is the message. */
	writeRejected: "GITHUB_WRITE_REJECTED",
	/** 503 — the server has no GITHUB_CREDENTIAL_ENCRYPTION_KEYS. */
	pullRequestsOff: "GITHUB_PULL_REQUESTS_OFF",
	/** 409 — a comment links a picture attached from the app that is gone (unused for a day) and was never committed: attach it again. */
	pictureUnavailable: "GITHUB_PICTURE_UNAVAILABLE",
} satisfies Record<string, string>;

// ── The linked account ─────────────────────────────────────────────────────

/** GitHub's prefix of a fine-grained personal access token — the only kind ADR 052 accepts. */
export const GITHUB_FINE_GRAINED_TOKEN_PREFIX = "github_pat_";
/** Longest fine-grained token accepted (GitHub's are ~93 characters today; room for a format change). */
export const GITHUB_TOKEN_MAX_LENGTH = 255;
const GITHUB_FINE_GRAINED_TOKEN_PATTERN = /^github_pat_[A-Za-z0-9_]+$/;

/** `PUT /github/account`: link (or replace) the caller's own fine-grained token. */
export const LinkGithubAccountSchema = z
	.object({
		personalAccessToken: z
			.string()
			.trim()
			.min(GITHUB_FINE_GRAINED_TOKEN_PREFIX.length + 1)
			.max(GITHUB_TOKEN_MAX_LENGTH)
			.regex(GITHUB_FINE_GRAINED_TOKEN_PATTERN, `must be a fine-grained personal access token (starts with ${GITHUB_FINE_GRAINED_TOKEN_PREFIX})`)
			.meta({ description: "A fine-grained personal access token — never returned or logged", example: "github_pat_11ABCDEFG0123456789_abcdefghijklmnopqrstuvwxyz" }),
	})
	.strict();

export type LinkGithubAccountInput = z.output<typeof LinkGithubAccountSchema>;

/** Whether the linked token still works: GitHub answering 401 for it marks it `rejected`. */
export const GithubAccountHealthSchema = z.enum(["active", "rejected"]);
export type GithubAccountHealth = z.output<typeof GithubAccountHealthSchema>;

/**
 * The caller's GitHub link. `off`: the deployment has no
 * `GITHUB_CREDENTIAL_ENCRYPTION_KEYS`, so pull requests are not available at
 * all. `unlinked`: available, no token yet. `linked`: the account the token
 * belongs to — never the token itself.
 */
export const GithubAccountStatusSchema = z.discriminatedUnion("status", [
	z.object({ status: z.literal("off") }),
	z.object({ status: z.literal("unlinked") }),
	z.object({
		status: z.literal("linked"),
		login: GithubAccountLoginSchema,
		avatarUrl: z.url().nullable(),
		health: GithubAccountHealthSchema,
		linkedAt: EpochMsSchema,
		/** When GitHub expires the token; `null` for a token without an expiry. */
		tokenExpiresAt: EpochMsSchema.nullable(),
	}),
]);

export type GithubAccountStatus = z.output<typeof GithubAccountStatusSchema>;

// ── People and labels ──────────────────────────────────────────────────────

/** A GitHub account as a pull request shows it; `null` where GitHub shows a deleted account ("ghost"). */
export const GithubActorSchema = z.object({
	login: GithubAccountLoginSchema,
	avatarUrl: z.url().nullable(),
});

export type GithubActor = z.output<typeof GithubActorSchema>;

/** GitHub's own limit on a label name. */
export const GITHUB_LABEL_NAME_MAX_LENGTH = 50;
/** Most labels shown on one pull request. */
export const GITHUB_PULL_REQUEST_LABELS_MAX = 20;

export const GithubLabelSchema = z.object({
	name: z.string().min(1).max(GITHUB_LABEL_NAME_MAX_LENGTH),
	/** Six hex digits, no `#` (GitHub's format). */
	color: z.string().regex(/^[0-9a-fA-F]{6}$/),
});

export type GithubLabel = z.output<typeof GithubLabelSchema>;

// ── The list ───────────────────────────────────────────────────────────────

/**
 * Which pull requests the list shows — the same inbox GitHub's own app has.
 * `yours`: in repositories the linked account owns. The API turns each into a
 * GitHub search; no search text comes from the client.
 */
export const GithubPullRequestFilterSchema = z.enum(["yours", "created", "reviewRequested", "assigned", "mentioned"]);
export type GithubPullRequestFilter = z.output<typeof GithubPullRequestFilterSchema>;

export const GithubPullRequestStateFilterSchema = z.enum(["open", "closed"]);
export type GithubPullRequestStateFilter = z.output<typeof GithubPullRequestStateFilterSchema>;

/** Pull requests per list page. */
export const GITHUB_PULL_REQUEST_PAGE_SIZE = 25;
/** Longest GitHub cursor accepted back from a client. */
export const GITHUB_CURSOR_MAX_LENGTH = 200;

const GithubCursorSchema = z.string().trim().min(1).max(GITHUB_CURSOR_MAX_LENGTH);

export const GithubPullRequestListQuerySchema = z
	.object({
		filter: GithubPullRequestFilterSchema.default("yours"),
		state: GithubPullRequestStateFilterSchema.default("open"),
		cursor: GithubCursorSchema.optional().describe("`nextCursor` of the previous page; omit for the most recently updated"),
	})
	.strict();

export type GithubPullRequestListQuery = z.output<typeof GithubPullRequestListQuerySchema>;
export type GithubPullRequestListInput = z.input<typeof GithubPullRequestListQuerySchema>;

/** A pull request's state, merged told apart from closed. */
export const GithubPullRequestStateSchema = z.enum(["open", "closed", "merged"]);
export type GithubPullRequestState = z.output<typeof GithubPullRequestStateSchema>;

/** Where the reviews stand, as GitHub decides it from the repository's review rules; `null` when no review is required. */
export const GithubReviewDecisionSchema = z.enum(["approved", "changesRequested", "reviewRequired"]);
export type GithubReviewDecision = z.output<typeof GithubReviewDecisionSchema>;

/** GitHub's own cap on a pull request number is the database's int range. */
const GITHUB_PULL_REQUEST_NUMBER_MAX = 2_147_483_647;

export const GithubPullRequestNumberSchema = z.coerce
	.number<number>()
	.int()
	.min(1)
	.max(GITHUB_PULL_REQUEST_NUMBER_MAX)
	.meta({ description: "Pull request number in its repository", example: 42 });

/** GitHub's own limit on a pull request title. */
export const GITHUB_PULL_REQUEST_TITLE_MAX_LENGTH = 256;

export const GithubPullRequestSummarySchema = z.object({
	owner: GithubOwnerSchema,
	repository: GithubRepositoryNameSchema,
	number: GithubPullRequestNumberSchema,
	title: z.string().max(GITHUB_PULL_REQUEST_TITLE_MAX_LENGTH),
	state: GithubPullRequestStateSchema,
	isDraft: z.boolean(),
	/** `null` when GitHub shows the author as a deleted account. */
	author: GithubActorSchema.nullable(),
	createdAt: EpochMsSchema,
	updatedAt: EpochMsSchema,
	/** Comments on the conversation (not counting review comments). */
	commentCount: z.number().int().nonnegative(),
	reviewDecision: GithubReviewDecisionSchema.nullable(),
	labels: z.array(GithubLabelSchema).max(GITHUB_PULL_REQUEST_LABELS_MAX),
	htmlUrl: z.url(),
});

export type GithubPullRequestSummary = z.output<typeof GithubPullRequestSummarySchema>;

export const GithubPullRequestPageSchema = z.object({
	items: z.array(GithubPullRequestSummarySchema).max(GITHUB_PULL_REQUEST_PAGE_SIZE),
	/** Pass back as `cursor` for the next page; `null` on the last page. */
	nextCursor: GithubCursorSchema.nullable(),
	/** How many pull requests match, as GitHub's search counts them. */
	totalCount: z.number().int().nonnegative(),
});

export type GithubPullRequestPage = z.output<typeof GithubPullRequestPageSchema>;

// ── One pull request ───────────────────────────────────────────────────────

/** Path params of one pull request: `/github/pull-requests/:owner/:repository/:number`. */
export const GithubPullRequestParamsSchema = z
	.object({
		owner: GithubOwnerSchema,
		repository: GithubRepositoryNameSchema,
		number: GithubPullRequestNumberSchema,
	})
	.strict();

export type GithubPullRequestParams = z.output<typeof GithubPullRequestParamsSchema>;
export type GithubPullRequestParamsInput = z.input<typeof GithubPullRequestParamsSchema>;

/** GitHub's own limit on a comment, review or pull request body. */
export const GITHUB_BODY_MAX_LENGTH = 65_536;
/** GitHub's own limit on a branch name. */
export const GITHUB_REF_NAME_MAX_LENGTH = 255;

/** Longest GitHub node id accepted (today's are ~20–40 characters). */
export const GITHUB_NODE_ID_MAX_LENGTH = 100;

/** A GitHub GraphQL node id (`PR_kwDO…`, `IC_kwDO…`) — what a comment is addressed by. */
export const GithubNodeIdSchema = z
	.string()
	.min(1)
	.max(GITHUB_NODE_ID_MAX_LENGTH)
	.regex(/^[A-Za-z0-9_=-]+$/, "must be a GitHub node id")
	.meta({ description: "GitHub node id", example: "IC_kwDOAbCdEf5r1sT2" });

export type GithubNodeId = z.output<typeof GithubNodeIdSchema>;

/** A comment-like body: who wrote it, the markdown, and whether it was edited (its history is `GET …/edits/:nodeId`). */
export const GithubCommentSchema = z.object({
	id: GithubNodeIdSchema,
	author: GithubActorSchema.nullable(),
	body: z.string().max(GITHUB_BODY_MAX_LENGTH),
	/** Where each image in `body` loads from (GitHub's signed links expire within minutes, so read them with the body). */
	images: GithubBodyImagesSchema,
	/** Its emoji reactions (only those someone chose), with whether the linked account chose each. */
	reactions: GithubReactionGroupsSchema,
	/** What to send to react to it (`PUT …/reactions`); `null` when GitHub takes no reactions on it from an API (a review's summary). */
	reactionSubject: GithubReactionSubjectSchema.nullable(),
	createdAt: EpochMsSchema,
	/** When it was last edited; `null` when never edited. */
	lastEditedAt: EpochMsSchema.nullable(),
	/** The linked account may edit it (its own comment, or a repository maintainer). */
	viewerCanUpdate: z.boolean(),
	viewerDidAuthor: z.boolean(),
	htmlUrl: z.url(),
});

export type GithubComment = z.output<typeof GithubCommentSchema>;

/** A submitted (or pending) review's verdict. */
export const GithubReviewStateSchema = z.enum(["approved", "changesRequested", "commented", "dismissed", "pending"]);
export type GithubReviewState = z.output<typeof GithubReviewStateSchema>;

/** Which side of a diff a line comment is on: the old file (`left`) or the new one (`right`). */
export const GithubDiffSideSchema = z.enum(["left", "right"]);
export type GithubDiffSide = z.output<typeof GithubDiffSideSchema>;

/** Longest diff hunk kept around a line comment. */
export const GITHUB_DIFF_HUNK_MAX_LENGTH = 20_000;

/** A comment on a line of the diff, with the hunk it was written against. */
export const GithubReviewCommentSchema = GithubCommentSchema.extend({
	path: z.string().min(1).max(GITHUB_FILE_PATH_MAX_LENGTH),
	/** The line in the file's current diff; `null` when the comment is outdated (the line changed since). */
	line: z.number().int().positive().nullable(),
	/** The line when the comment was written. */
	originalLine: z.number().int().positive().nullable(),
	diffHunk: z.string().max(GITHUB_DIFF_HUNK_MAX_LENGTH),
});

export type GithubReviewComment = z.output<typeof GithubReviewCommentSchema>;

/** Most line comments shown inside one review in the conversation (the rest are in the files' threads). */
export const GITHUB_REVIEW_COMMENTS_SHOWN_MAX = 20;

/** A review: its verdict, its summary (the comment fields) and the line comments it left. */
export const GithubReviewSchema = GithubCommentSchema.extend({
	state: GithubReviewStateSchema,
	/** When it was submitted; `null` while pending. */
	submittedAt: EpochMsSchema.nullable(),
	comments: z.array(GithubReviewCommentSchema).max(GITHUB_REVIEW_COMMENTS_SHOWN_MAX),
	/** How many line comments the review has in all. */
	commentCount: z.number().int().nonnegative(),
});

export type GithubReview = z.output<typeof GithubReviewSchema>;

/** Kinds of events the conversation shows between comments and reviews. */
export const GithubTimelineEventKindSchema = z.enum([
	"closed",
	"reopened",
	"merged",
	"readyForReview",
	"convertedToDraft",
	"reviewRequested",
	"labeled",
	"unlabeled",
	"headRefForcePushed",
	"renamed",
]);
export type GithubTimelineEventKind = z.output<typeof GithubTimelineEventKindSchema>;

/** Longest one-line detail of an event (a label name, a requested reviewer, a new title). */
export const GITHUB_TIMELINE_EVENT_DETAIL_MAX_LENGTH = 300;

/** One entry of the conversation, oldest first: a comment, a review, a pushed commit, or an event. */
export const GithubTimelineItemSchema = z.discriminatedUnion("type", [
	z.object({ type: z.literal("comment"), comment: GithubCommentSchema }),
	z.object({ type: z.literal("review"), review: GithubReviewSchema }),
	z.object({ type: z.literal("commit"), commit: GithubCommitSchema.pick({ sha: true, shortSha: true, headline: true, committedAt: true, author: true }) }),
	z.object({
		type: z.literal("event"),
		kind: GithubTimelineEventKindSchema,
		actor: GithubActorSchema.nullable(),
		createdAt: EpochMsSchema,
		/** What the event was about, when it names something (a label, a reviewer, the new title). */
		detail: z.string().max(GITHUB_TIMELINE_EVENT_DETAIL_MAX_LENGTH).nullable(),
	}),
]);

export type GithubTimelineItem = z.output<typeof GithubTimelineItemSchema>;

/** Conversation entries per page. */
export const GITHUB_TIMELINE_PAGE_SIZE = 50;

export const GithubTimelinePageSchema = z.object({
	items: z.array(GithubTimelineItemSchema).max(GITHUB_TIMELINE_PAGE_SIZE),
	/** Pass back as `cursor` for the next (newer) page; `null` on the last page. */
	nextCursor: GithubCursorSchema.nullable(),
});

export type GithubTimelinePage = z.output<typeof GithubTimelinePageSchema>;

/** The query of a cursor-paged list (the conversation, the commits): the previous page's `nextCursor`, or none for the first page. */
export const GithubCursorQuerySchema = z
	.object({
		cursor: GithubCursorSchema.optional().describe("`nextCursor` of the previous page; omit for the first page"),
	})
	.strict();

export type GithubCursorQuery = z.output<typeof GithubCursorQuerySchema>;

/** A pull request's path params plus a page cursor (`…/timeline`, `…/commits`). */
export const GithubPullRequestCursorInputSchema = z.intersection(GithubPullRequestParamsSchema, GithubCursorQuerySchema);
export type GithubPullRequestCursorInput = z.input<typeof GithubPullRequestCursorInputSchema>;

/** Most requested reviewers shown. */
export const GITHUB_REQUESTED_REVIEWERS_MAX = 20;

/**
 * One pull request as its page shows it: the summary, the description, the
 * branches, the size, and the first page of the conversation. `viewerCan…`
 * say what the linked account may do — GitHub decides, the app only shows it.
 */
export const GithubPullRequestDetailSchema = GithubPullRequestSummarySchema.extend({
	id: GithubNodeIdSchema,
	/** The description, markdown. */
	body: z.string().max(GITHUB_BODY_MAX_LENGTH),
	/** Where each image in the description loads from. */
	bodyImages: GithubBodyImagesSchema,
	/** The description's emoji reactions (subject `pullRequest`). */
	reactions: GithubReactionGroupsSchema,
	bodyLastEditedAt: EpochMsSchema.nullable(),
	/** The branch it merges into, and the branch it brings. */
	baseRef: z.string().min(1).max(GITHUB_REF_NAME_MAX_LENGTH),
	headRef: z.string().min(1).max(GITHUB_REF_NAME_MAX_LENGTH),
	/** The head branch's repository owner when it is a fork; `null` for a branch of the same repository. */
	headOwner: GithubOwnerSchema.nullable(),
	additions: z.number().int().nonnegative(),
	deletions: z.number().int().nonnegative(),
	changedFiles: z.number().int().nonnegative(),
	commitCount: z.number().int().nonnegative(),
	requestedReviewers: z.array(GithubActorSchema).max(GITHUB_REQUESTED_REVIEWERS_MAX),
	mergedAt: EpochMsSchema.nullable(),
	closedAt: EpochMsSchema.nullable(),
	/** The linked account opened it — GitHub does not let an author approve or request changes. */
	viewerDidAuthor: z.boolean(),
	/** The linked account may edit it, close or reopen it. */
	viewerCanUpdate: z.boolean(),
	timeline: GithubTimelinePageSchema,
});

export type GithubPullRequestDetail = z.output<typeof GithubPullRequestDetailSchema>;

// ── Commits, files and line comments ───────────────────────────────────────

/** GitHub lists at most this many commits of one pull request. */
export const GITHUB_PULL_REQUEST_COMMITS_MAX = 250;
/** Commits per page. */
export const GITHUB_PULL_REQUEST_COMMIT_PAGE_SIZE = 50;

export const GithubPullRequestCommitPageSchema = z.object({
	items: z.array(GithubCommitSchema).max(GITHUB_PULL_REQUEST_COMMIT_PAGE_SIZE),
	nextCursor: GithubCursorSchema.nullable(),
	totalCount: z.number().int().nonnegative(),
});

export type GithubPullRequestCommitPage = z.output<typeof GithubPullRequestCommitPageSchema>;

/** Files per page — GitHub's own page size for a pull request's files. */
export const GITHUB_PULL_REQUEST_FILE_PAGE_SIZE = GITHUB_COMMIT_FILES_MAX;
/** GitHub lists at most 3,000 files of one pull request: 30 pages. */
export const GITHUB_PULL_REQUEST_FILE_PAGES_MAX = 30;

export const GithubPullRequestFilesQuerySchema = z
	.object({
		page: z.coerce.number<number>().int().min(1).max(GITHUB_PULL_REQUEST_FILE_PAGES_MAX).default(1).describe("Page of changed files, from 1"),
	})
	.strict();

export type GithubPullRequestFilesQuery = z.output<typeof GithubPullRequestFilesQuerySchema>;

/** A pull request's path params plus the files page (`…/files`). */
export const GithubPullRequestFilesInputSchema = z.intersection(GithubPullRequestParamsSchema, GithubPullRequestFilesQuerySchema);
export type GithubPullRequestFilesInput = z.input<typeof GithubPullRequestFilesInputSchema>;

/** One page of a pull request's changed files with their diffs (the same diff rules as a commit's). */
export const GithubPullRequestFilePageSchema = z.object({
	files: z.array(GithubCommitFileSchema).max(GITHUB_PULL_REQUEST_FILE_PAGE_SIZE),
	/** The next page number; `null` on the last page. */
	nextPage: z.number().int().min(2).max(GITHUB_PULL_REQUEST_FILE_PAGES_MAX).nullable(),
	/** The head commit the diffs belong to — a line comment is written against it. */
	headSha: GithubCommitShaSchema,
});

export type GithubPullRequestFilePage = z.output<typeof GithubPullRequestFilePageSchema>;

/** Most line-comment threads listed for one pull request. */
export const GITHUB_REVIEW_THREADS_MAX = 100;
/** Most comments listed in one thread. */
export const GITHUB_REVIEW_THREAD_COMMENTS_MAX = 50;

/** A conversation on one line of the diff. */
export const GithubReviewThreadSchema = z.object({
	id: GithubNodeIdSchema,
	path: z.string().min(1).max(GITHUB_FILE_PATH_MAX_LENGTH),
	/** The line in the current diff; `null` when outdated. */
	line: z.number().int().positive().nullable(),
	originalLine: z.number().int().positive().nullable(),
	side: GithubDiffSideSchema,
	isResolved: z.boolean(),
	isOutdated: z.boolean(),
	comments: z.array(GithubReviewCommentSchema).max(GITHUB_REVIEW_THREAD_COMMENTS_MAX),
});

export type GithubReviewThread = z.output<typeof GithubReviewThreadSchema>;

export const GithubReviewThreadListSchema = z.object({
	threads: z.array(GithubReviewThreadSchema).max(GITHUB_REVIEW_THREADS_MAX),
	/** `true` when the pull request has more threads than listed (they are on GitHub). */
	truncated: z.boolean(),
});

export type GithubReviewThreadList = z.output<typeof GithubReviewThreadListSchema>;

/** Path params of one of a pull request's commits: `…/:number/commits/:sha` — read with the caller's own token. */
export const GithubPullRequestCommitParamsSchema = GithubPullRequestParamsSchema.extend({ sha: GithubCommitShaSchema }).strict();
export type GithubPullRequestCommitParams = z.output<typeof GithubPullRequestCommitParamsSchema>;
export type GithubPullRequestCommitParamsInput = z.input<typeof GithubPullRequestCommitParamsSchema>;

// ── Merge status: checks and conflicts (GitHub's merge box) ────────────────

/** Where the head commit's checks stand, as GitHub rolls them up. */
export const GithubChecksStateSchema = z.enum(["success", "failure", "pending"]);
export type GithubChecksState = z.output<typeof GithubChecksStateSchema>;

const CheckCountSchema = z.number().int().nonnegative();

/**
 * The head commit's checks. `none`: the commit has no checks or statuses.
 * `unavailable`: GitHub would not show them to the linked token. `summary`:
 * GitHub's rollup and how many checks are in each bucket.
 */
export const GithubChecksSchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("none") }),
	z.object({ kind: z.literal("unavailable") }),
	z.object({
		kind: z.literal("summary"),
		state: GithubChecksStateSchema,
		successful: CheckCountSchema,
		failed: CheckCountSchema,
		pending: CheckCountSchema,
		skipped: CheckCountSchema,
	}),
]);

export type GithubChecks = z.output<typeof GithubChecksSchema>;

/** Whether the branch merges cleanly into its base; `unknown` while GitHub is still working it out. */
export const GithubMergeabilitySchema = z.enum(["mergeable", "conflicting", "unknown"]);
export type GithubMergeability = z.output<typeof GithubMergeabilitySchema>;

/** How a pull request is merged — GitHub's three methods. */
export const GithubMergeMethodSchema = z.enum(["merge", "squash", "rebase"]);
export type GithubMergeMethod = z.output<typeof GithubMergeMethodSchema>;

/**
 * GitHub's verdict on merging now (`mergeStateStatus`): `clean` — ready; `unstable` — checks failing
 * but not required; `hasHooks` — ready, with pre-receive hooks; `behind` — the base moved on (merging
 * may still be allowed); `blocked` — required reviews or checks are missing; `dirty` — conflicts;
 * `draft`; `unknown` — GitHub is still working it out.
 */
export const GithubMergeStateSchema = z.enum(["clean", "unstable", "hasHooks", "behind", "blocked", "dirty", "draft", "unknown"]);
export type GithubMergeState = z.output<typeof GithubMergeStateSchema>;

/** What merging needs: the head commit merged, GitHub's verdict, the repository's merge settings, and the branch. */
export const GithubMergeOptionsSchema = z.object({
	/** The head commit — the merge is pinned to it, so commits pushed after it was read are never merged unseen. */
	headSha: GithubCommitShaSchema,
	state: GithubMergeStateSchema,
	/** The methods the repository allows, in GitHub's order (merge commit, squash, rebase). */
	methods: z.array(GithubMergeMethodSchema).max(GithubMergeMethodSchema.options.length),
	/** The method GitHub suggests to the linked account; `null` when it suggests none. */
	defaultMethod: GithubMergeMethodSchema.nullable(),
	headBranch: z.string().min(1).max(GITHUB_REF_NAME_MAX_LENGTH),
	/** The branch is in this repository (not a fork's), so it can be deleted after merging. */
	canDeleteHeadBranch: z.boolean(),
	/** The repository deletes head branches by itself after a merge (its "Automatically delete head branches" setting). */
	deletesBranchOnMerge: z.boolean(),
});
export type GithubMergeOptions = z.output<typeof GithubMergeOptionsSchema>;

/** `GET …/:number/status`: what GitHub's merge box shows, read live. */
export const GithubPullRequestStatusSchema = z.object({
	checks: GithubChecksSchema,
	mergeability: GithubMergeabilitySchema,
	merge: GithubMergeOptionsSchema,
});

export type GithubPullRequestStatus = z.output<typeof GithubPullRequestStatusSchema>;

// ── Writing: comments and reviews (synced to GitHub) ───────────────────────

/** A comment or review text: markdown, not blank, within GitHub's own limit. */
export const GithubWrittenBodySchema = z
	.string()
	.trim()
	.min(1, "Write something first")
	.max(GITHUB_BODY_MAX_LENGTH)
	.meta({ description: "Markdown, as GitHub renders it", example: "Looks good — one question on the parser." });

/** `POST …/comments`: a comment on the pull request's conversation. */
export const AddGithubPullRequestCommentSchema = z.object({ body: GithubWrittenBodySchema }).strict();
export type AddGithubPullRequestCommentInput = z.output<typeof AddGithubPullRequestCommentSchema>;

/** A pull request plus the comment (`POST …/comments`). */
export const AddGithubPullRequestCommentInputSchema = z.intersection(GithubPullRequestParamsSchema, AddGithubPullRequestCommentSchema);
export type AddGithubPullRequestCommentRequest = z.input<typeof AddGithubPullRequestCommentInputSchema>;

// ── Merging ────────────────────────────────────────────────────────────────

/** GitHub's own limit on a commit title it shows; longer is cut by GitHub anyway. */
export const GITHUB_MERGE_TITLE_MAX_LENGTH = 256;

/** `POST …/:number/merge`: how to merge, pinned to the head commit that was read. */
export const MergeGithubPullRequestSchema = z
	.object({
		method: GithubMergeMethodSchema,
		/** The head commit the person saw — GitHub refuses the merge when the branch has moved on since. */
		expectedHeadSha: GithubCommitShaSchema,
		/** The merge or squash commit's title; empty uses GitHub's own. Ignored by `rebase`. */
		commitTitle: z.string().trim().max(GITHUB_MERGE_TITLE_MAX_LENGTH).default(""),
		/** The commit's message; empty uses GitHub's own. Ignored by `rebase`. */
		commitMessage: z.string().max(GITHUB_BODY_MAX_LENGTH).default(""),
		/** Delete the head branch once merged (only a branch of this repository). */
		deleteBranch: z.boolean(),
	})
	.strict();
export type MergeGithubPullRequestInput = z.output<typeof MergeGithubPullRequestSchema>;

export const MergeGithubPullRequestInputSchema = z.intersection(GithubPullRequestParamsSchema, MergeGithubPullRequestSchema);
export type MergeGithubPullRequestRequest = z.input<typeof MergeGithubPullRequestInputSchema>;

/**
 * The merge as GitHub made it. The branch deletion runs after it and never undoes it:
 * `branch` is `deleted`, `kept` (not asked, or a fork's branch), or `failed` with GitHub's reason.
 */
export const GithubMergeResultSchema = z.object({
	sha: GithubCommitShaSchema,
	branch: z.discriminatedUnion("outcome", [
		z.object({ outcome: z.literal("deleted") }),
		z.object({ outcome: z.literal("kept") }),
		z.object({ outcome: z.literal("failed"), reason: z.string().max(GITHUB_TIMELINE_EVENT_DETAIL_MAX_LENGTH) }),
	]),
});
export type GithubMergeResult = z.output<typeof GithubMergeResultSchema>;

// ── Pictures in comments ───────────────────────────────────────────────────

/**
 * The branch the app commits comment pictures to, in the pull request's
 * repository — its own history, never merged, so the code's branches stay clean.
 */
export const GITHUB_COMMENT_ASSETS_BRANCH = "github-comment-assets";

/**
 * `POST …/:number/pictures`: a READY `GITHUB_COMMENT_IMAGE` the caller uploaded, for a comment. It
 * is committed to the repository when a comment or review that links it is posted, never before —
 * a picture taken out of the draft again is never committed.
 */
export const AttachGithubCommentPictureSchema = z.object({ fileId: z.uuid() }).strict();
export type AttachGithubCommentPictureInput = z.output<typeof AttachGithubCommentPictureSchema>;

export const AttachGithubCommentPictureInputSchema = z.intersection(GithubPullRequestParamsSchema, AttachGithubCommentPictureSchema);
export type AttachGithubCommentPictureRequest = z.input<typeof AttachGithubCommentPictureInputSchema>;

/** Where an attached picture will be: the address a comment links it by (GitHub shows it to whoever may read the repository). */
export const GithubCommentPictureSchema = z.object({
	url: z.url({ protocol: /^https$/ }),
	/** Where it is in the repository, on {@link GITHUB_COMMENT_ASSETS_BRANCH}. */
	path: z.string().min(1).max(GITHUB_FILE_PATH_MAX_LENGTH),
});
export type GithubCommentPicture = z.output<typeof GithubCommentPictureSchema>;

// ── Pictures for the app ───────────────────────────────────────────────────
// GitHub shows a repository file, or an upload to a private repository, only
// to a signed-in reader. The API lists such a picture with an address of its
// own (`GithubBodyImage.url`), which the app opens signed in as itself — the
// address names no reader and never expires, and the API reads the picture
// with the reader's own token at that moment.

/** Where the API serves those pictures (`apiRoutes.githubPictures` lives under it). */
export const GITHUB_PICTURES_PATH = "/github/pictures";

/** `GET /github/pictures/file`: a file in a repository at a branch, tag or commit. */
export const GithubRepositoryFileSchema = z
	.object({
		owner: GithubOwnerSchema,
		repository: GithubRepositoryNameSchema,
		ref: z.string().min(1).max(GITHUB_REF_NAME_MAX_LENGTH),
		path: z
			.string()
			.min(1)
			.max(GITHUB_FILE_PATH_MAX_LENGTH)
			.refine(
				(path: string): boolean => !path.split("/").some((segment: string): boolean => segment === ".." || segment === "." || segment.length === 0),
				"must be a plain file path",
			),
	})
	.strict();
export type GithubRepositoryFile = z.output<typeof GithubRepositoryFileSchema>;

/** The id GitHub gives an upload (`github.com/user-attachments/assets/<id>`). */
export const GithubAttachmentIdSchema = z
	.string()
	.regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u, "must be a GitHub upload id")
	.meta({ description: "GitHub upload id", example: "4b5c6d7e-8f90-4a1b-9c2d-3e4f5a6b7c8d" });

/** `GET /github/pictures/uploads/:attachmentId`. */
export const GithubUploadedPictureParamsSchema = z.object({ attachmentId: GithubAttachmentIdSchema }).strict();
export type GithubUploadedPictureParams = z.output<typeof GithubUploadedPictureParamsSchema>;

/** `?node=`: the comment, review or pull request whose body shows the upload — GitHub signs its link there. */
export const GithubUploadedPictureQuerySchema = z.object({ node: GithubNodeIdSchema }).strict();
export type GithubUploadedPictureQuery = z.output<typeof GithubUploadedPictureQuerySchema>;

/** `PUT …/:number/reactions`: the pull request's path params plus the reaction to set. */
export const SetGithubReactionInputSchema = z.intersection(GithubPullRequestParamsSchema, SetGithubReactionSchema);
export type SetGithubReactionRequest = z.input<typeof SetGithubReactionInputSchema>;

/** A review's verdict, as GitHub's "Review changes" offers it. GitHub does not let an author approve or request changes on their own pull request. */
export const GithubReviewEventSchema = z.enum(["comment", "approve", "requestChanges"]);
export type GithubReviewEvent = z.output<typeof GithubReviewEventSchema>;

/**
 * `POST …/reviews`: submit a review. A summary is required to comment or
 * request changes (GitHub's own rule) and optional to approve.
 */
export const SubmitGithubPullRequestReviewSchema = z
	.object({
		event: GithubReviewEventSchema,
		body: z.string().trim().max(GITHUB_BODY_MAX_LENGTH).default(""),
	})
	.strict()
	.refine((review): boolean => review.event === "approve" || review.body.length > 0, {
		path: ["body"],
		message: "Write a summary to comment or request changes",
	});

export type SubmitGithubPullRequestReviewInput = z.output<typeof SubmitGithubPullRequestReviewSchema>;

/** A pull request plus the review (`POST …/reviews`). */
export const SubmitGithubPullRequestReviewInputSchema = z.intersection(GithubPullRequestParamsSchema, SubmitGithubPullRequestReviewSchema);
export type SubmitGithubPullRequestReviewRequest = z.input<typeof SubmitGithubPullRequestReviewInputSchema>;

// ── Edit history ───────────────────────────────────────────────────────────

/** Most edits listed for one comment or description. */
export const GITHUB_CONTENT_EDITS_MAX = 50;

/** Path param of an edit history: the comment's, review's or pull request's node id. */
export const GithubContentEditParamsSchema = z.object({ nodeId: GithubNodeIdSchema }).strict();
export type GithubContentEditParams = z.output<typeof GithubContentEditParamsSchema>;

/** One version of a comment: who saved it, when, and the text as it was saved (`null` once deleted from history). */
export const GithubContentEditSchema = z.object({
	editedAt: EpochMsSchema,
	editor: GithubActorSchema.nullable(),
	body: z.string().max(GITHUB_BODY_MAX_LENGTH).nullable(),
});

export type GithubContentEdit = z.output<typeof GithubContentEditSchema>;

/** A comment's edits, newest first; the last entry is the original text. */
export const GithubContentEditHistorySchema = z.object({
	edits: z.array(GithubContentEditSchema).max(GITHUB_CONTENT_EDITS_MAX),
	totalCount: z.number().int().nonnegative(),
});

export type GithubContentEditHistory = z.output<typeof GithubContentEditHistorySchema>;

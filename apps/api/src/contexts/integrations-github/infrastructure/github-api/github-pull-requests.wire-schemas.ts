// ============================================
// github-pull-requests.wire-schemas.ts - What GitHub answers about pull requests
// ============================================
// Parsed before any field is used (ADR 045's rule): objects strip what we do
// not read, a missing or mistyped field we DO read is a 502. Each field here is
// asked for in `github-pull-requests.queries.ts` (or is a REST field).

import { z } from "zod";

import { GithubCommitFileWireSchema, GithubCommitNodeWireSchema, GraphqlErrorsWireSchema, TotalCountWireSchema } from "./github.wire-schemas";

const IsoDateTimeWireSchema = z.iso.datetime({ offset: true });

const PageInfoWireSchema = z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() });

/** An author or actor — `null` for a deleted account ("ghost"). */
export const GithubActorWireSchema = z.object({ login: z.string(), avatarUrl: z.url() }).nullable();

export type GithubActorWire = z.output<typeof GithubActorWireSchema>;

// ── Comments, reviews and the conversation ─────────────────────────────────

/** GitHub's `ReactionContent`. */
export const GithubReactionContentWireSchema = z.enum(["THUMBS_UP", "THUMBS_DOWN", "LAUGH", "HOORAY", "CONFUSED", "HEART", "ROCKET", "EYES"]);

export type GithubReactionContentWire = z.output<typeof GithubReactionContentWireSchema>;

/** Every reaction with its count — GitHub lists all eight, chosen or not. */
export const GithubReactionGroupsWireSchema = z
	.array(z.object({ content: GithubReactionContentWireSchema, viewerHasReacted: z.boolean(), reactors: TotalCountWireSchema }))
	.nullable();

export type GithubReactionGroupsWire = z.output<typeof GithubReactionGroupsWireSchema>;

export const GithubCommentWireSchema = z.object({
	id: z.string(),
	/** GitHub's numeric id, as a string; `null` for content GitHub has not given one. */
	fullDatabaseId: z.string().nullable(),
	author: GithubActorWireSchema,
	body: z.string(),
	/** GitHub's rendering of `body` — only its image links are read. */
	bodyHTML: z.string(),
	reactionGroups: GithubReactionGroupsWireSchema,
	createdAt: IsoDateTimeWireSchema,
	lastEditedAt: IsoDateTimeWireSchema.nullable(),
	viewerCanUpdate: z.boolean(),
	viewerDidAuthor: z.boolean(),
	url: z.url(),
});

export type GithubCommentWire = z.output<typeof GithubCommentWireSchema>;

export const GithubReviewCommentWireSchema = GithubCommentWireSchema.extend({
	path: z.string(),
	line: z.number().int().positive().nullable(),
	originalLine: z.number().int().positive().nullable(),
	diffHunk: z.string(),
});

export type GithubReviewCommentWire = z.output<typeof GithubReviewCommentWireSchema>;

export const GithubReviewStateWireSchema = z.enum(["PENDING", "COMMENTED", "APPROVED", "CHANGES_REQUESTED", "DISMISSED"]);

const EventFields = { actor: GithubActorWireSchema, createdAt: IsoDateTimeWireSchema };

/** A reviewer a review was requested from: a person or bot (has a login), or a team (has a name). */
const RequestedReviewerWireSchema = z
	.discriminatedUnion("__typename", [
		z.object({ __typename: z.literal("User"), login: z.string() }),
		z.object({ __typename: z.literal("Bot"), login: z.string() }),
		z.object({ __typename: z.literal("Mannequin"), login: z.string() }),
		z.object({ __typename: z.literal("Team"), name: z.string() }),
	])
	.nullable();

/** A submitted (or pending) review in the conversation, with the first of its line comments. */
export const GithubReviewNodeWireSchema = GithubCommentWireSchema.extend({
	__typename: z.literal("PullRequestReview"),
	state: GithubReviewStateWireSchema,
	submittedAt: IsoDateTimeWireSchema.nullable(),
	comments: TotalCountWireSchema.extend({ nodes: z.array(GithubReviewCommentWireSchema) }),
});

export type GithubReviewNodeWire = z.output<typeof GithubReviewNodeWireSchema>;

/** "Review requested from …" in the conversation. */
export const GithubReviewRequestedEventWireSchema = z.object({
	__typename: z.literal("ReviewRequestedEvent"),
	...EventFields,
	requestedReviewer: RequestedReviewerWireSchema,
});

export type GithubReviewRequestedEventWire = z.output<typeof GithubReviewRequestedEventWireSchema>;

export const GithubTimelineNodeWireSchema = z.discriminatedUnion("__typename", [
	GithubCommentWireSchema.extend({ __typename: z.literal("IssueComment") }),
	GithubReviewNodeWireSchema,
	z.object({
		__typename: z.literal("PullRequestCommit"),
		commit: z.object({
			oid: z.string(),
			abbreviatedOid: z.string(),
			messageHeadline: z.string(),
			committedDate: IsoDateTimeWireSchema,
			author: z.object({ name: z.string().nullable(), user: GithubActorWireSchema }).nullable(),
		}),
	}),
	z.object({ __typename: z.literal("ClosedEvent"), ...EventFields }),
	z.object({ __typename: z.literal("ReopenedEvent"), ...EventFields }),
	z.object({ __typename: z.literal("MergedEvent"), ...EventFields, mergeRefName: z.string() }),
	z.object({ __typename: z.literal("ReadyForReviewEvent"), ...EventFields }),
	z.object({ __typename: z.literal("ConvertToDraftEvent"), ...EventFields }),
	GithubReviewRequestedEventWireSchema,
	z.object({ __typename: z.literal("LabeledEvent"), ...EventFields, label: z.object({ name: z.string() }) }),
	z.object({ __typename: z.literal("UnlabeledEvent"), ...EventFields, label: z.object({ name: z.string() }) }),
	z.object({ __typename: z.literal("HeadRefForcePushedEvent"), ...EventFields }),
	z.object({ __typename: z.literal("RenamedTitleEvent"), ...EventFields, currentTitle: z.string() }),
]);

export type GithubTimelineNodeWire = z.output<typeof GithubTimelineNodeWireSchema>;

export const GithubTimelineConnectionWireSchema = z.object({
	pageInfo: PageInfoWireSchema,
	nodes: z.array(GithubTimelineNodeWireSchema),
});

export type GithubTimelineConnectionWire = z.output<typeof GithubTimelineConnectionWireSchema>;

// ── The list (search) ──────────────────────────────────────────────────────

export const GithubPullRequestSummaryWireSchema = z.object({
	number: z.number().int().positive(),
	title: z.string(),
	state: z.enum(["OPEN", "CLOSED", "MERGED"]),
	isDraft: z.boolean(),
	createdAt: IsoDateTimeWireSchema,
	updatedAt: IsoDateTimeWireSchema,
	url: z.url(),
	reviewDecision: z.enum(["APPROVED", "CHANGES_REQUESTED", "REVIEW_REQUIRED"]).nullable(),
	repository: z.object({ name: z.string(), owner: z.object({ login: z.string() }) }),
	author: GithubActorWireSchema,
	comments: TotalCountWireSchema,
	labels: z.object({ nodes: z.array(z.object({ name: z.string(), color: z.string() })) }).nullable(),
});

export type GithubPullRequestSummaryWire = z.output<typeof GithubPullRequestSummaryWireSchema>;

/** A search result is a pull request (the query asks for `is:pr`); GitHub sends `null` for one the token cannot see. */
const SearchNodeWireSchema = GithubPullRequestSummaryWireSchema.extend({ __typename: z.literal("PullRequest") }).nullable();

export const GithubPullRequestSearchResponseWireSchema = z.object({
	data: z
		.object({
			search: z.object({
				issueCount: z.number().int().nonnegative(),
				pageInfo: PageInfoWireSchema,
				nodes: z.array(SearchNodeWireSchema),
			}),
		})
		.nullish(),
	errors: GraphqlErrorsWireSchema.optional(),
});

export type GithubPullRequestSearchWire = NonNullable<z.output<typeof GithubPullRequestSearchResponseWireSchema>["data"]>["search"];

// ── One pull request ───────────────────────────────────────────────────────

const ReviewRequestReviewerWireSchema = z
	.discriminatedUnion("__typename", [
		z.object({ __typename: z.literal("User"), login: z.string(), avatarUrl: z.url() }),
		z.object({ __typename: z.literal("Bot"), login: z.string(), avatarUrl: z.url() }),
		z.object({ __typename: z.literal("Mannequin"), login: z.string(), avatarUrl: z.url() }),
		z.object({ __typename: z.literal("Team") }),
	])
	.nullable();

export const GithubPullRequestDetailWireSchema = GithubPullRequestSummaryWireSchema.extend({
	id: z.string(),
	body: z.string(),
	bodyHTML: z.string(),
	reactionGroups: GithubReactionGroupsWireSchema,
	lastEditedAt: IsoDateTimeWireSchema.nullable(),
	baseRefName: z.string(),
	headRefName: z.string(),
	isCrossRepository: z.boolean(),
	headRepositoryOwner: z.object({ login: z.string() }).nullable(),
	additions: z.number().int().nonnegative(),
	deletions: z.number().int().nonnegative(),
	changedFiles: z.number().int().nonnegative(),
	commits: TotalCountWireSchema,
	mergedAt: IsoDateTimeWireSchema.nullable(),
	closedAt: IsoDateTimeWireSchema.nullable(),
	viewerDidAuthor: z.boolean(),
	viewerCanUpdate: z.boolean(),
	reviewRequests: z.object({ nodes: z.array(z.object({ requestedReviewer: ReviewRequestReviewerWireSchema })) }).nullable(),
	timelineItems: GithubTimelineConnectionWireSchema,
});

export type GithubPullRequestDetailWire = z.output<typeof GithubPullRequestDetailWireSchema>;

/** `repository.pullRequest` of a query — `null` when GitHub shows the token no such pull request. */
function pullRequestResponse<T extends z.ZodType>(
	pullRequest: T,
): z.ZodObject<{
	data: z.ZodOptional<z.ZodNullable<z.ZodObject<{ repository: z.ZodNullable<z.ZodObject<{ pullRequest: z.ZodNullable<T> }>> }>>>;
	errors: z.ZodOptional<typeof GraphqlErrorsWireSchema>;
}> {
	return z.object({
		data: z.object({ repository: z.object({ pullRequest: pullRequest.nullable() }).nullable() }).nullish(),
		errors: GraphqlErrorsWireSchema.optional(),
	});
}

export const GithubPullRequestDetailResponseWireSchema = pullRequestResponse(GithubPullRequestDetailWireSchema);

export const GithubPullRequestTimelineResponseWireSchema = pullRequestResponse(z.object({ timelineItems: GithubTimelineConnectionWireSchema }));

/** A pull request's commit: the same fields as a history commit (`GithubCommitNodeWireSchema`). */
const PullRequestCommitNodeWireSchema = z.object({ commit: GithubCommitNodeWireSchema });

export const GithubPullRequestCommitsWireSchema = z.object({
	totalCount: z.number().int().nonnegative(),
	pageInfo: PageInfoWireSchema,
	nodes: z.array(PullRequestCommitNodeWireSchema),
});

export type GithubPullRequestCommitsWire = z.output<typeof GithubPullRequestCommitsWireSchema>;

export const GithubPullRequestCommitsResponseWireSchema = pullRequestResponse(z.object({ commits: GithubPullRequestCommitsWireSchema }));

export const GithubReviewThreadWireSchema = z.object({
	id: z.string(),
	path: z.string(),
	line: z.number().int().positive().nullable(),
	originalLine: z.number().int().positive().nullable(),
	diffSide: z.enum(["LEFT", "RIGHT"]),
	isResolved: z.boolean(),
	isOutdated: z.boolean(),
	comments: z.object({ nodes: z.array(GithubReviewCommentWireSchema) }),
});

export type GithubReviewThreadWire = z.output<typeof GithubReviewThreadWireSchema>;

export const GithubReviewThreadsWireSchema = z.object({
	headRefOid: z.string(),
	reviewThreads: TotalCountWireSchema.extend({ nodes: z.array(GithubReviewThreadWireSchema) }),
});

export type GithubReviewThreadsWire = z.output<typeof GithubReviewThreadsWireSchema>;

export const GithubReviewThreadsResponseWireSchema = pullRequestResponse(GithubReviewThreadsWireSchema);

export const GithubPullRequestHeadResponseWireSchema = pullRequestResponse(z.object({ headRefOid: z.string() }));

/** `GET /repos/{owner}/{repo}/pulls/{number}/files` — one page of changed files. */
export const GithubPullRequestFilesWireSchema = z.array(GithubCommitFileWireSchema);

// ── Edit history ───────────────────────────────────────────────────────────

export const GithubContentEditWireSchema = z.object({
	editedAt: IsoDateTimeWireSchema,
	deletedAt: IsoDateTimeWireSchema.nullable(),
	diff: z.string().nullable(),
	editor: GithubActorWireSchema,
});

export type GithubContentEditWire = z.output<typeof GithubContentEditWireSchema>;

/** `node(id)` — any node; only comment-like ones carry `userContentEdits`. */
export const GithubContentEditsResponseWireSchema = z.object({
	data: z
		.object({
			node: z
				.object({
					__typename: z.string(),
					userContentEdits: TotalCountWireSchema.extend({ nodes: z.array(GithubContentEditWireSchema.nullable()) }).optional(),
				})
				.nullable(),
		})
		.nullish(),
	errors: GraphqlErrorsWireSchema.optional(),
});

export type GithubContentEditsWire = NonNullable<NonNullable<NonNullable<z.output<typeof GithubContentEditsResponseWireSchema>["data"]>["node"]>["userContentEdits"]>;

// ── The token's own account (linking) ──────────────────────────────────────

/** `GET /user` — who a token belongs to. */
export const GithubAuthenticatedUserWireSchema = z.object({
	id: z.number().int().positive(),
	login: z.string(),
	avatar_url: z.url(),
});

export type GithubAuthenticatedUserWire = z.output<typeof GithubAuthenticatedUserWireSchema>;

// ── Writes (REST) ──────────────────────────────────────────────────────────

/** The account a REST answer names (`user`) — `null` for a deleted account. */
const RestUserWireSchema = z.object({ login: z.string(), avatar_url: z.url() }).nullable();

/** `POST /repos/:owner/:repo/issues/:number/comments` — the comment as GitHub saved it. */
export const GithubPostedCommentWireSchema = z.object({
	id: z.number().int().positive(),
	node_id: z.string(),
	user: RestUserWireSchema,
	body: z.string(),
	created_at: IsoDateTimeWireSchema,
	html_url: z.url(),
});

export type GithubPostedCommentWire = z.output<typeof GithubPostedCommentWireSchema>;

/** `POST /repos/:owner/:repo/pulls/:number/reviews` — the review as GitHub saved it (a summary may be empty or absent). */
export const GithubSubmittedReviewWireSchema = z.object({
	node_id: z.string(),
	user: RestUserWireSchema,
	body: z.string().nullable(),
	state: GithubReviewStateWireSchema,
	submitted_at: IsoDateTimeWireSchema.nullish(),
	html_url: z.url(),
});

export type GithubSubmittedReviewWire = z.output<typeof GithubSubmittedReviewWireSchema>;

// ── Reactions (REST) ───────────────────────────────────────────────────────

/** One reaction as GitHub's REST API lists it: its id (to delete it) and who chose it. */
export const GithubRestReactionWireSchema = z.object({ id: z.number().int().positive(), content: z.string(), user: RestUserWireSchema });

export const GithubRestReactionListWireSchema = z.array(GithubRestReactionWireSchema);

export type GithubRestReactionWire = z.output<typeof GithubRestReactionWireSchema>;

// ── Merge status ───────────────────────────────────────────────────────────

export const GithubMergeableWireSchema = z.enum(["MERGEABLE", "CONFLICTING", "UNKNOWN"]);

export type GithubMergeableWire = z.output<typeof GithubMergeableWireSchema>;

/** GitHub's `MergeStateStatus`. */
export const GithubMergeStateStatusWireSchema = z.enum(["BEHIND", "BLOCKED", "CLEAN", "DIRTY", "DRAFT", "HAS_HOOKS", "UNKNOWN", "UNSTABLE"]);
export type GithubMergeStateStatusWire = z.output<typeof GithubMergeStateStatusWireSchema>;

/** GitHub's `PullRequestMergeMethod`. */
export const GithubMergeMethodWireSchema = z.enum(["MERGE", "SQUASH", "REBASE"]);
export type GithubMergeMethodWire = z.output<typeof GithubMergeMethodWireSchema>;

const GithubMergePullRequestWireSchema = z.object({
	mergeable: GithubMergeableWireSchema,
	mergeStateStatus: GithubMergeStateStatusWireSchema,
	headRefOid: z.string(),
	headRefName: z.string(),
	isCrossRepository: z.boolean(),
});

/** `GITHUB_PULL_REQUEST_MERGEABILITY_QUERY`: the repository's merge settings and the pull request's merge state. */
export const GithubPullRequestMergeabilityResponseWireSchema = z.object({
	data: z
		.object({
			repository: z
				.object({
					mergeCommitAllowed: z.boolean(),
					squashMergeAllowed: z.boolean(),
					rebaseMergeAllowed: z.boolean(),
					deleteBranchOnMerge: z.boolean(),
					viewerDefaultMergeMethod: GithubMergeMethodWireSchema.nullable(),
					pullRequest: GithubMergePullRequestWireSchema.nullable(),
				})
				.nullable(),
		})
		.nullish(),
	errors: GraphqlErrorsWireSchema.optional(),
});

/** The repository's merge settings with the pull request's merge state. */
export type GithubMergeStateWire = Omit<NonNullable<NonNullable<z.output<typeof GithubPullRequestMergeabilityResponseWireSchema>["data"]>["repository"]>, "pullRequest"> & {
	readonly pullRequest: z.output<typeof GithubMergePullRequestWireSchema>;
};

/** `PUT /repos/:owner/:repo/pulls/:number/merge` — the commit GitHub made. */
export const GithubMergedWireSchema = z.object({ sha: z.string(), merged: z.boolean() });

/** GitHub's `CheckRunState` — a check run's status or conclusion. */
export const GithubCheckRunStateWireSchema = z.enum([
	"ACTION_REQUIRED",
	"CANCELLED",
	"COMPLETED",
	"FAILURE",
	"IN_PROGRESS",
	"NEUTRAL",
	"PENDING",
	"QUEUED",
	"SKIPPED",
	"STALE",
	"STARTUP_FAILURE",
	"SUCCESS",
	"TIMED_OUT",
	"WAITING",
]);

export type GithubCheckRunStateWire = z.output<typeof GithubCheckRunStateWireSchema>;

/** GitHub's `StatusState` — a commit status's, and the rollup's. */
export const GithubStatusStateWireSchema = z.enum(["ERROR", "EXPECTED", "FAILURE", "PENDING", "SUCCESS"]);

export type GithubStatusStateWire = z.output<typeof GithubStatusStateWireSchema>;

const CountWireSchema = z.number().int().nonnegative();

export const GithubCheckRollupWireSchema = z.object({
	state: GithubStatusStateWireSchema,
	contexts: z.object({
		checkRunCountsByState: z.array(z.object({ state: GithubCheckRunStateWireSchema, count: CountWireSchema })).nullable(),
		statusContextCountsByState: z.array(z.object({ state: GithubStatusStateWireSchema, count: CountWireSchema })).nullable(),
	}),
});

export type GithubCheckRollupWire = z.output<typeof GithubCheckRollupWireSchema>;

/** The last commit's rollup — `null` for a commit with no checks or statuses. */
export const GithubPullRequestChecksResponseWireSchema = pullRequestResponse(
	z.object({ commits: z.object({ nodes: z.array(z.object({ commit: z.object({ statusCheckRollup: GithubCheckRollupWireSchema.nullable() }) })) }) }),
);

// ── Repository files (comment pictures) ────────────────────────────────────

/** `GITHUB_BRANCH_HEAD_QUERY`: `ref` is `null` when the branch does not exist; `repository` when the token cannot see it. */
export const GithubBranchHeadResponseWireSchema = z.object({
	data: z.object({ repository: z.object({ ref: z.object({ target: z.object({ oid: z.string() }) }).nullable() }).nullable() }).nullish(),
	errors: GraphqlErrorsWireSchema.optional(),
});

/** {@link GITHUB_FILE_EXISTS_QUERY}'s answer: the object at `<branch>:<path>`, `null` when there is none. */
export const GithubFileExistsResponseWireSchema = z.object({
	data: z.object({ repository: z.object({ object: z.object({ __typename: z.string() }).nullable() }).nullable() }).nullish(),
	errors: GraphqlErrorsWireSchema.optional(),
});

/** {@link GITHUB_NODE_BODY_HTML_QUERY}'s answer: `bodyHTML` is absent for a node of any other kind. */
export const GithubNodeBodyHtmlResponseWireSchema = z.object({
	data: z.object({ node: z.object({ bodyHTML: z.string().optional() }).nullable() }).nullish(),
	errors: GraphqlErrorsWireSchema.optional(),
});

/** Every Git object GitHub creates answers its SHA (`POST /git/blobs`, `/git/trees`, `/git/commits`). */
export const GithubGitObjectWireSchema = z.object({ sha: z.string() });

/** `PUT /repos/:owner/:repo/contents/:path` — the file as committed. */
export const GithubCommittedFileWireSchema = z.object({ content: z.object({ path: z.string() }) });

// ── Webhooks (live updates) ────────────────────────────────────────────────

/** A repository webhook as REST answers it; `config.url` is where it delivers. */
export const GithubHookWireSchema = z.object({ id: z.number().int().positive(), config: z.object({ url: z.string().optional() }) });

export const GithubHookListWireSchema = z.array(GithubHookWireSchema);

export type GithubHookWire = z.output<typeof GithubHookWireSchema>;

/** `GITHUB_REPOSITORY_VISIBLE_QUERY`: `repository` is `null` when the token cannot see it. */
export const GithubRepositoryVisibleResponseWireSchema = z.object({
	data: z.object({ repository: z.object({ id: z.string() }).nullable() }).nullish(),
	errors: GraphqlErrorsWireSchema.optional(),
});

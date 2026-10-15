// ============================================
// github-pull-requests.mappers.ts - GitHub's answers → the pull-request contract
// ============================================
// Pure functions over validated wire shapes. Everything a client sees is
// decided here: names, the order of things, what is cut to the contract's
// limits, and how GitHub's enums read in ours.

import {
	assertNever,
	epochMs,
	GITHUB_REACTION_CONTENTS,
	GithubDatabaseIdSchema,
	GITHUB_CONTENT_EDITS_MAX,
	GITHUB_PULL_REQUEST_LABELS_MAX,
	GITHUB_REQUESTED_REVIEWERS_MAX,
	GITHUB_REVIEW_COMMENTS_SHOWN_MAX,
	GITHUB_REVIEW_THREADS_MAX,
	GITHUB_TIMELINE_EVENT_DETAIL_MAX_LENGTH,
	type EpochMs,
	type GithubActor,
	type GithubChecks,
	type GithubChecksState,
	type GithubComment,
	type GithubContentEditHistory,
	type GithubPullRequestCommitPage,
	type GithubPullRequestDetail,
	type GithubPullRequestFilePage,
	type GithubPullRequestPage,
	type GithubPullRequestState,
	type GithubReactionContent,
	type GithubReactionGroup,
	type GithubReactionSubject,
	type GithubPullRequestSummary,
	type GithubMergeability,
	type GithubMergeMethod,
	type GithubMergeOptions,
	type GithubMergeState,
	type GithubReview,
	type GithubReviewComment,
	type GithubReviewDecision,
	type GithubReviewState,
	type GithubReviewThread,
	type GithubReviewThreadList,
	type GithubTimelineEventKind,
	type GithubTimelineItem,
	type GithubTimelinePage,
} from "@workspace/shared";

import { toChangedFiles, toCommit, UNKNOWN_COMMIT_AUTHOR } from "../github.mappers";
import { toBodyImages, type BodyImageLink } from "./github-body-images";
import type { GithubPullRequestFilesResult } from "./github-pull-request.client";
import type {
	GithubActorWire,
	GithubCommentWire,
	GithubContentEditsWire,
	GithubPullRequestCommitsWire,
	GithubPullRequestDetailWire,
	GithubPullRequestSearchWire,
	GithubPullRequestSummaryWire,
	GithubReviewCommentWire,
	GithubCheckRollupWire,
	GithubCheckRunStateWire,
	GithubMergeableWire,
	GithubMergeMethodWire,
	GithubMergeStateStatusWire,
	GithubMergeStateWire,
	GithubPostedCommentWire,
	GithubStatusStateWire,
	GithubReviewNodeWire,
	GithubSubmittedReviewWire,
	GithubReviewRequestedEventWire,
	GithubReviewThreadsWire,
	GithubReactionContentWire,
	GithubReactionGroupsWire,
	GithubReviewThreadWire,
	GithubTimelineConnectionWire,
	GithubTimelineNodeWire,
} from "./github-pull-requests.wire-schemas";

function toEpochMs(isoDateTime: string): EpochMs {
	return epochMs(Date.parse(isoDateTime));
}

function toNullableEpochMs(isoDateTime: string | null): EpochMs | null {
	return isoDateTime === null ? null : toEpochMs(isoDateTime);
}

export function toActor(actor: GithubActorWire): GithubActor | null {
	return actor === null ? null : { login: actor.login, avatarUrl: actor.avatarUrl };
}

const PULL_REQUEST_STATES: Readonly<Record<GithubPullRequestSummaryWire["state"], GithubPullRequestState>> = {
	OPEN: "open",
	CLOSED: "closed",
	MERGED: "merged",
};

const REVIEW_DECISIONS: Readonly<Record<NonNullable<GithubPullRequestSummaryWire["reviewDecision"]>, GithubReviewDecision>> = {
	APPROVED: "approved",
	CHANGES_REQUESTED: "changesRequested",
	REVIEW_REQUIRED: "reviewRequired",
};

const REVIEW_STATES: Readonly<Record<GithubReviewNodeWire["state"], GithubReviewState>> = {
	PENDING: "pending",
	COMMENTED: "commented",
	APPROVED: "approved",
	CHANGES_REQUESTED: "changesRequested",
	DISMISSED: "dismissed",
};

export function toPullRequestSummary(node: GithubPullRequestSummaryWire): GithubPullRequestSummary {
	return {
		owner: node.repository.owner.login,
		repository: node.repository.name,
		number: node.number,
		title: node.title,
		state: PULL_REQUEST_STATES[node.state],
		isDraft: node.isDraft,
		author: toActor(node.author),
		createdAt: toEpochMs(node.createdAt),
		updatedAt: toEpochMs(node.updatedAt),
		commentCount: node.comments.totalCount,
		reviewDecision: node.reviewDecision === null ? null : REVIEW_DECISIONS[node.reviewDecision],
		labels: (node.labels?.nodes ?? []).slice(0, GITHUB_PULL_REQUEST_LABELS_MAX).map((label) => ({ name: label.name, color: label.color })),
		htmlUrl: node.url,
	};
}

/** A search page; results the token cannot see (`null`) are left out. */
export function toPullRequestPage(search: GithubPullRequestSearchWire): GithubPullRequestPage {
	return {
		items: search.nodes.flatMap((node): GithubPullRequestSummary[] => (node === null ? [] : [toPullRequestSummary(node)])),
		nextCursor: search.pageInfo.hasNextPage ? search.pageInfo.endCursor : null,
		totalCount: search.issueCount,
	};
}

/** GitHub's reaction names in ours. */
const REACTION_CONTENTS: Readonly<Record<GithubReactionContentWire, GithubReactionContent>> = {
	THUMBS_UP: "thumbsUp",
	THUMBS_DOWN: "thumbsDown",
	LAUGH: "laugh",
	HOORAY: "hooray",
	CONFUSED: "confused",
	HEART: "heart",
	ROCKET: "rocket",
	EYES: "eyes",
};

/** The reactions someone chose, in GitHub's order. */
export function toReactions(groups: GithubReactionGroupsWire): GithubReactionGroup[] {
	const chosen = new Map<GithubReactionContent, GithubReactionGroup>();
	for (const group of groups ?? []) {
		if (group.reactors.totalCount > 0) {
			const content = REACTION_CONTENTS[group.content];
			chosen.set(content, { content, count: group.reactors.totalCount, viewerHasReacted: group.viewerHasReacted });
		}
	}
	return GITHUB_REACTION_CONTENTS.flatMap((content: GithubReactionContent): GithubReactionGroup[] => {
		const group = chosen.get(content);
		return group === undefined ? [] : [group];
	});
}

/** What GitHub's REST reactions address a comment by; `null` when GitHub gave it no numeric id. */
function commentSubject(type: "issueComment" | "reviewComment", fullDatabaseId: string | null): GithubReactionSubject | null {
	const commentId = GithubDatabaseIdSchema.safeParse(fullDatabaseId);
	return commentId.success ? { type, commentId: commentId.data } : null;
}

/** A comment-like body; `reactionSubject` is set by the kind of comment it is (a review's summary takes none). */
export function toComment(comment: GithubCommentWire, links: BodyImageLink): GithubComment {
	return {
		id: comment.id,
		author: toActor(comment.author),
		body: comment.body,
		images: toBodyImages(comment.bodyHTML, comment.id, links),
		reactions: toReactions(comment.reactionGroups),
		reactionSubject: null,
		createdAt: toEpochMs(comment.createdAt),
		lastEditedAt: toNullableEpochMs(comment.lastEditedAt),
		viewerCanUpdate: comment.viewerCanUpdate,
		viewerDidAuthor: comment.viewerDidAuthor,
		htmlUrl: comment.url,
	};
}

export function toReviewComment(comment: GithubReviewCommentWire, links: BodyImageLink): GithubReviewComment {
	return {
		...toComment(comment, links),
		reactionSubject: commentSubject("reviewComment", comment.fullDatabaseId),
		path: comment.path,
		line: comment.line,
		originalLine: comment.originalLine,
		diffHunk: comment.diffHunk,
	};
}

/** A review with the first of its line comments — in the conversation, or as a submitted one comes back. */
export function toReview(node: GithubReviewNodeWire, links: BodyImageLink): GithubReview {
	return {
		...toComment(node, links),
		state: REVIEW_STATES[node.state],
		submittedAt: toNullableEpochMs(node.submittedAt),
		comments: node.comments.nodes.slice(0, GITHUB_REVIEW_COMMENTS_SHOWN_MAX).map((comment) => toReviewComment(comment, links)),
		commentCount: node.comments.totalCount,
	};
}

/** The REST answer's author (`user`) in the contract's shape. */
function toRestActor(user: GithubPostedCommentWire["user"]): GithubActor | null {
	return user === null ? null : { login: user.login, avatarUrl: user.avatar_url };
}

/**
 * A comment the caller just posted: theirs, so they wrote it and may edit it;
 * never edited yet. REST does not render it, so its image links (`images`) come
 * with the conversation, which the app reloads after posting.
 */
export function toPostedComment(comment: GithubPostedCommentWire): GithubComment {
	return {
		id: comment.node_id,
		author: toRestActor(comment.user),
		body: comment.body,
		images: [],
		reactions: [],
		reactionSubject: { type: "issueComment", commentId: String(comment.id) },
		createdAt: toEpochMs(comment.created_at),
		lastEditedAt: null,
		viewerCanUpdate: true,
		viewerDidAuthor: true,
		htmlUrl: comment.html_url,
	};
}

/** A review the caller just submitted; its line comments (none from this app yet) come with the conversation. */
export function toSubmittedReview(review: GithubSubmittedReviewWire, nowMs: number): GithubReview {
	const submittedAt = review.submitted_at === undefined || review.submitted_at === null ? null : toEpochMs(review.submitted_at);
	return {
		id: review.node_id,
		author: toRestActor(review.user),
		body: review.body ?? "",
		images: [],
		reactions: [],
		reactionSubject: null,
		createdAt: submittedAt ?? epochMs(nowMs),
		lastEditedAt: null,
		viewerCanUpdate: true,
		viewerDidAuthor: true,
		htmlUrl: review.html_url,
		state: REVIEW_STATES[review.state],
		submittedAt,
		comments: [],
		commentCount: 0,
	};
}

/** An event's one-line detail, cut to the contract's limit. */
function eventDetail(detail: string | null): string | null {
	return detail === null ? null : detail.slice(0, GITHUB_TIMELINE_EVENT_DETAIL_MAX_LENGTH);
}

function event(node: { readonly actor: GithubActorWire; readonly createdAt: string }, kind: GithubTimelineEventKind, detail: string | null): GithubTimelineItem {
	return { type: "event", kind, actor: toActor(node.actor), createdAt: toEpochMs(node.createdAt), detail: eventDetail(detail) };
}

/** Who a review was requested from: a person's or bot's login, or a team's name. */
function requestedReviewerName(reviewer: GithubReviewRequestedEventWire["requestedReviewer"]): string | null {
	if (reviewer === null) {
		return null;
	}
	return reviewer.__typename === "Team" ? reviewer.name : reviewer.login;
}

export function toTimelineItem(node: GithubTimelineNodeWire, links: BodyImageLink): GithubTimelineItem {
	switch (node.__typename) {
		case "IssueComment":
			return { type: "comment", comment: { ...toComment(node, links), reactionSubject: commentSubject("issueComment", node.fullDatabaseId) } };
		case "PullRequestReview":
			return { type: "review", review: toReview(node, links) };
		case "PullRequestCommit": {
			const user = node.commit.author?.user ?? null;
			return {
				type: "commit",
				commit: {
					sha: node.commit.oid,
					shortSha: node.commit.abbreviatedOid,
					headline: node.commit.messageHeadline,
					committedAt: toEpochMs(node.commit.committedDate),
					author: { name: node.commit.author?.name ?? user?.login ?? UNKNOWN_COMMIT_AUTHOR, login: user?.login ?? null, avatarUrl: user?.avatarUrl ?? null },
				},
			};
		}
		case "ClosedEvent":
			return event(node, "closed", null);
		case "ReopenedEvent":
			return event(node, "reopened", null);
		case "MergedEvent":
			return event(node, "merged", node.mergeRefName);
		case "ReadyForReviewEvent":
			return event(node, "readyForReview", null);
		case "ConvertToDraftEvent":
			return event(node, "convertedToDraft", null);
		case "ReviewRequestedEvent":
			return event(node, "reviewRequested", requestedReviewerName(node.requestedReviewer));
		case "LabeledEvent":
			return event(node, "labeled", node.label.name);
		case "UnlabeledEvent":
			return event(node, "unlabeled", node.label.name);
		case "HeadRefForcePushedEvent":
			return event(node, "headRefForcePushed", null);
		case "RenamedTitleEvent":
			return event(node, "renamed", node.currentTitle);
		default:
			return assertNever(node, "GitHub timeline item");
	}
}

export function toTimelinePage(connection: GithubTimelineConnectionWire, links: BodyImageLink): GithubTimelinePage {
	return {
		items: connection.nodes.map((node) => toTimelineItem(node, links)),
		nextCursor: connection.pageInfo.hasNextPage ? connection.pageInfo.endCursor : null,
	};
}

/** Reviewers still asked for, people and bots only (a team has no login). */
function toRequestedReviewers(node: GithubPullRequestDetailWire): GithubActor[] {
	return (node.reviewRequests?.nodes ?? [])
		.flatMap(({ requestedReviewer }): GithubActor[] =>
			requestedReviewer === null || requestedReviewer.__typename === "Team" ? [] : [{ login: requestedReviewer.login, avatarUrl: requestedReviewer.avatarUrl }],
		)
		.slice(0, GITHUB_REQUESTED_REVIEWERS_MAX);
}

export function toPullRequestDetail(node: GithubPullRequestDetailWire, links: BodyImageLink): GithubPullRequestDetail {
	return {
		...toPullRequestSummary(node),
		id: node.id,
		body: node.body,
		bodyImages: toBodyImages(node.bodyHTML, node.id, links),
		reactions: toReactions(node.reactionGroups),
		bodyLastEditedAt: toNullableEpochMs(node.lastEditedAt),
		baseRef: node.baseRefName,
		headRef: node.headRefName,
		headOwner: node.isCrossRepository ? (node.headRepositoryOwner?.login ?? null) : null,
		additions: node.additions,
		deletions: node.deletions,
		changedFiles: node.changedFiles,
		commitCount: node.commits.totalCount,
		requestedReviewers: toRequestedReviewers(node),
		mergedAt: toNullableEpochMs(node.mergedAt),
		closedAt: toNullableEpochMs(node.closedAt),
		viewerDidAuthor: node.viewerDidAuthor,
		viewerCanUpdate: node.viewerCanUpdate,
		timeline: toTimelinePage(node.timelineItems, links),
	};
}

export function toPullRequestCommitPage(commits: GithubPullRequestCommitsWire): GithubPullRequestCommitPage {
	return {
		items: commits.nodes.map((node) => toCommit(node.commit)),
		nextCursor: commits.pageInfo.hasNextPage ? commits.pageInfo.endCursor : null,
		totalCount: commits.totalCount,
	};
}

/** One page of files with the same diff limits as a commit's; `page` is the page just read. */
export function toPullRequestFilePage(result: GithubPullRequestFilesResult, page: number, headSha: string): GithubPullRequestFilePage {
	return { files: toChangedFiles(result.files), nextPage: result.hasNextPage ? page + 1 : null, headSha };
}

function toReviewThread(thread: GithubReviewThreadWire, links: BodyImageLink): GithubReviewThread {
	return {
		id: thread.id,
		path: thread.path,
		line: thread.line,
		originalLine: thread.originalLine,
		side: thread.diffSide === "LEFT" ? "left" : "right",
		isResolved: thread.isResolved,
		isOutdated: thread.isOutdated,
		comments: thread.comments.nodes.map((comment) => toReviewComment(comment, links)),
	};
}

export function toReviewThreadList(wire: GithubReviewThreadsWire, links: BodyImageLink): GithubReviewThreadList {
	return {
		threads: wire.reviewThreads.nodes.slice(0, GITHUB_REVIEW_THREADS_MAX).map((thread) => toReviewThread(thread, links)),
		truncated: wire.reviewThreads.totalCount > wire.reviewThreads.nodes.length,
	};
}

/** Newest first, as GitHub lists them; an edit removed from the history keeps its entry without its text. */
export function toContentEditHistory(edits: GithubContentEditsWire): GithubContentEditHistory {
	return {
		edits: edits.nodes
			.flatMap((edit) => (edit === null ? [] : [edit]))
			.slice(0, GITHUB_CONTENT_EDITS_MAX)
			.map((edit) => ({ editedAt: toEpochMs(edit.editedAt), editor: toActor(edit.editor), body: edit.deletedAt === null ? edit.diff : null })),
		totalCount: edits.totalCount,
	};
}

// ── Merge status ───────────────────────────────────────────────────────────

/** Which count a check is shown in — GitHub's merge box: neutral counts as passed, cancelled or timed out as failed. */
type CheckBucket = "successful" | "failed" | "pending" | "skipped";

const CHECK_RUN_BUCKETS: Readonly<Record<GithubCheckRunStateWire, CheckBucket>> = {
	SUCCESS: "successful",
	NEUTRAL: "successful",
	COMPLETED: "successful",
	SKIPPED: "skipped",
	FAILURE: "failed",
	CANCELLED: "failed",
	TIMED_OUT: "failed",
	ACTION_REQUIRED: "failed",
	STARTUP_FAILURE: "failed",
	STALE: "failed",
	PENDING: "pending",
	QUEUED: "pending",
	IN_PROGRESS: "pending",
	WAITING: "pending",
};

const STATUS_BUCKETS: Readonly<Record<GithubStatusStateWire, CheckBucket>> = {
	SUCCESS: "successful",
	FAILURE: "failed",
	ERROR: "failed",
	PENDING: "pending",
	EXPECTED: "pending",
};

const ROLLUP_STATES: Readonly<Record<GithubStatusStateWire, GithubChecksState>> = {
	SUCCESS: "success",
	FAILURE: "failure",
	ERROR: "failure",
	PENDING: "pending",
	EXPECTED: "pending",
};

const MERGEABILITY: Readonly<Record<GithubMergeableWire, GithubMergeability>> = {
	MERGEABLE: "mergeable",
	CONFLICTING: "conflicting",
	UNKNOWN: "unknown",
};

export function toMergeability(mergeable: GithubMergeableWire): GithubMergeability {
	return MERGEABILITY[mergeable];
}

const MERGE_STATES: Readonly<Record<GithubMergeStateStatusWire, GithubMergeState>> = {
	BEHIND: "behind",
	BLOCKED: "blocked",
	CLEAN: "clean",
	DIRTY: "dirty",
	DRAFT: "draft",
	HAS_HOOKS: "hasHooks",
	UNKNOWN: "unknown",
	UNSTABLE: "unstable",
};

const MERGE_METHODS: Readonly<Record<GithubMergeMethodWire, GithubMergeMethod>> = { MERGE: "merge", SQUASH: "squash", REBASE: "rebase" };

/** What merging needs, from the repository's settings and the pull request's merge state. */
export function toMergeOptions(state: GithubMergeStateWire): GithubMergeOptions {
	const allowed: readonly [GithubMergeMethod, boolean][] = [
		["merge", state.mergeCommitAllowed],
		["squash", state.squashMergeAllowed],
		["rebase", state.rebaseMergeAllowed],
	];
	const methods = allowed.flatMap(([method, isAllowed]): GithubMergeMethod[] => (isAllowed ? [method] : []));
	const suggested = state.viewerDefaultMergeMethod === null ? null : MERGE_METHODS[state.viewerDefaultMergeMethod];
	return {
		headSha: state.pullRequest.headRefOid,
		state: MERGE_STATES[state.pullRequest.mergeStateStatus],
		methods,
		defaultMethod: suggested !== null && methods.includes(suggested) ? suggested : (methods.at(0) ?? null),
		headBranch: state.pullRequest.headRefName,
		canDeleteHeadBranch: !state.pullRequest.isCrossRepository,
		deletesBranchOnMerge: state.deleteBranchOnMerge,
	};
}

/** The head commit's checks; `null` rollup means it has none, `undefined` that GitHub would not show them. */
export function toChecks(rollup: GithubCheckRollupWire | null | undefined): GithubChecks {
	if (rollup === undefined) {
		return { kind: "unavailable" };
	}
	if (rollup === null) {
		return { kind: "none" };
	}
	const counts: Record<CheckBucket, number> = { successful: 0, failed: 0, pending: 0, skipped: 0 };
	for (const { state, count } of rollup.contexts.checkRunCountsByState ?? []) {
		counts[CHECK_RUN_BUCKETS[state]] += count;
	}
	for (const { state, count } of rollup.contexts.statusContextCountsByState ?? []) {
		counts[STATUS_BUCKETS[state]] += count;
	}
	return { kind: "summary", state: ROLLUP_STATES[rollup.state], ...counts };
}

import {
	GITHUB_PULL_REQUEST_LABELS_MAX,
	GITHUB_TIMELINE_EVENT_DETAIL_MAX_LENGTH,
	GithubContentEditHistorySchema,
	GithubPullRequestDetailSchema,
	GithubPullRequestPageSchema,
	GithubReviewThreadListSchema,
	GithubTimelinePageSchema,
	type GithubMergeability,
} from "@workspace/shared";
import { describe, expect, it } from "vitest";

import {
	toContentEditHistory,
	toPullRequestCommitPage,
	toPullRequestDetail,
	toPullRequestFilePage,
	toPullRequestPage,
	toPullRequestSummary,
	toReviewThreadList,
	toTimelineItem,
	toTimelinePage,
	toChecks,
	toMergeability,
	toMergeOptions,
	toPostedComment,
	toSubmittedReview,
} from "../github-pull-requests.mappers";
import { AS_GITHUB_SERVES } from "../github-body-images";
import type { GithubMergeableWire, GithubTimelineNodeWire } from "../github-pull-requests.wire-schemas";
import {
	mergeStateWire,
	actorWire,
	commentNodeWire,
	CREATED_AT,
	CREATED_AT_MS,
	detailWire,
	HEAD_SHA,
	reviewNodeWire,
	reviewThreadWire,
	summaryWire,
	UPDATED_AT,
	UPDATED_AT_MS,
} from "./github-pull-request-wire.builders";

const EVENT = { actor: actorWire("maintainer"), createdAt: CREATED_AT };

describe("pull-request mappers", () => {
	it("maps a list row into the contract, GitHub's enums in our words", () => {
		const summary = toPullRequestSummary(summaryWire({ state: "MERGED", reviewDecision: "CHANGES_REQUESTED" }));

		expect(summary).toEqual({
			owner: "octo-org",
			repository: "hello-world",
			number: 42,
			title: "Add pull request screens",
			state: "merged",
			isDraft: false,
			author: { login: "octocat", avatarUrl: "https://avatars.githubusercontent.com/octocat" },
			createdAt: CREATED_AT_MS,
			updatedAt: UPDATED_AT_MS,
			commentCount: 3,
			reviewDecision: "changesRequested",
			labels: [{ name: "enhancement", color: "a2eeef" }],
			htmlUrl: "https://github.com/octo-org/hello-world/pull/42",
		});
	});

	it("shows a deleted author as nobody, and no review decision when none is required", () => {
		const summary = toPullRequestSummary(summaryWire({ author: null, reviewDecision: null, labels: null }));

		expect(summary.author).toBeNull();
		expect(summary.reviewDecision).toBeNull();
		expect(summary.labels).toEqual([]);
	});

	it("keeps at most the contract's labels", () => {
		const labels = Array.from({ length: GITHUB_PULL_REQUEST_LABELS_MAX + 5 }, (_: undefined, index: number) => ({ name: `label-${String(index)}`, color: "ededed" }));

		expect(toPullRequestSummary(summaryWire({ labels: { nodes: labels } })).labels).toHaveLength(GITHUB_PULL_REQUEST_LABELS_MAX);
	});

	it("builds a search page, leaving out results the token cannot see", () => {
		const page = toPullRequestPage({
			issueCount: 2,
			pageInfo: { hasNextPage: true, endCursor: "next" },
			nodes: [{ ...summaryWire(), __typename: "PullRequest" }, null],
		});

		expect(GithubPullRequestPageSchema.parse(page)).toEqual(page);
		expect(page.items).toHaveLength(1);
		expect(page.nextCursor).toBe("next");
		expect(page.totalCount).toBe(2);
	});

	it("ends the list on the last page", () => {
		expect(toPullRequestPage({ issueCount: 0, pageInfo: { hasNextPage: false, endCursor: "last" }, nodes: [] }).nextCursor).toBeNull();
	});

	it("maps a pull request with its branches, reviewers and first page of conversation — within the contract", () => {
		const detail = toPullRequestDetail(detailWire(), AS_GITHUB_SERVES);

		expect(GithubPullRequestDetailSchema.parse(detail)).toEqual(detail);
		expect(detail.baseRef).toBe("main");
		expect(detail.headRef).toBe("feature/pull-requests");
		expect(detail.headOwner).toBeNull();
		// A team has no login: only people and bots are listed.
		expect(detail.requestedReviewers).toEqual([{ login: "reviewer-one", avatarUrl: "https://avatars.githubusercontent.com/reviewer-one" }]);
		expect(detail.timeline.items.map((item) => item.type)).toEqual(["comment", "review"]);
		expect(detail.timeline.nextCursor).toBe("Y3Vyc29yOjE=");
	});

	it("sends where the images of the description and of each comment load from", () => {
		const image = '<img src="https://camo.githubusercontent.com/abc" data-canonical-src="https://example.com/a.png">';
		const detail = toPullRequestDetail(detailWire({ bodyHTML: image }), AS_GITHUB_SERVES);
		const comment = toTimelineItem(commentNodeWire({ bodyHTML: image }), AS_GITHUB_SERVES);
		const listed = [{ source: "https://example.com/a.png", url: "https://camo.githubusercontent.com/abc" }];

		expect(detail.bodyImages).toEqual(listed);
		expect(comment).toMatchObject({ type: "comment", comment: { images: listed } });
		expect(toPullRequestDetail(detailWire(), AS_GITHUB_SERVES).bodyImages).toEqual([]);
	});

	it("lists the reactions someone chose in GitHub's order, and what each kind of comment is reacted to by", () => {
		const detail = toPullRequestDetail(detailWire(), AS_GITHUB_SERVES);
		const [comment, review] = detail.timeline.items;

		expect(detail.reactions).toEqual([
			{ content: "thumbsUp", count: 1, viewerHasReacted: false },
			{ content: "rocket", count: 3, viewerHasReacted: false },
		]);
		expect(comment).toMatchObject({
			type: "comment",
			comment: { reactions: [{ content: "heart", count: 2, viewerHasReacted: true }], reactionSubject: { type: "issueComment", commentId: "6186769145" } },
		});
		// A review's summary takes no reactions through REST; its line comments do.
		expect(review).toMatchObject({ type: "review", review: { reactionSubject: null, comments: [{ reactionSubject: { type: "reviewComment", commentId: "6186769145" } }] } });
		expect(toTimelineItem(commentNodeWire({ fullDatabaseId: null }), AS_GITHUB_SERVES)).toMatchObject({ type: "comment", comment: { reactionSubject: null } });
		expect(toTimelineItem(commentNodeWire({ reactionGroups: null }), AS_GITHUB_SERVES)).toMatchObject({ type: "comment", comment: { reactions: [] } });
	});

	it("names the fork a cross-repository pull request comes from", () => {
		expect(toPullRequestDetail(detailWire({ isCrossRepository: true, headRepositoryOwner: { login: "contributor" } }), AS_GITHUB_SERVES).headOwner).toBe("contributor");
	});

	it("maps a review with its verdict and line comments", () => {
		const item = toTimelineItem(reviewNodeWire({ lastEditedAt: UPDATED_AT }), AS_GITHUB_SERVES);

		expect(item.type).toBe("review");
		if (item.type !== "review") {
			return;
		}
		expect(item.review.state).toBe("changesRequested");
		expect(item.review.lastEditedAt).toBe(UPDATED_AT_MS);
		expect(item.review.commentCount).toBe(1);
		expect(item.review.comments.at(0)?.path).toBe("src/app.ts");
	});

	it("maps a pushed commit, crediting the git name when the email maps to no account", () => {
		const item = toTimelineItem(
			{
				__typename: "PullRequestCommit",
				commit: { oid: HEAD_SHA, abbreviatedOid: "4f2a9c1", messageHeadline: "Add screens", committedDate: CREATED_AT, author: { name: "Sam", user: null } },
			},
			AS_GITHUB_SERVES,
		);

		expect(item).toEqual({
			type: "commit",
			commit: { sha: HEAD_SHA, shortSha: "4f2a9c1", headline: "Add screens", committedAt: CREATED_AT_MS, author: { name: "Sam", login: null, avatarUrl: null } },
		});
	});

	it.each<[string, GithubTimelineNodeWire, string, string | null]>([
		["closed", { __typename: "ClosedEvent", ...EVENT }, "closed", null],
		["reopened", { __typename: "ReopenedEvent", ...EVENT }, "reopened", null],
		["merged", { __typename: "MergedEvent", ...EVENT, mergeRefName: "main" }, "merged", "main"],
		["ready for review", { __typename: "ReadyForReviewEvent", ...EVENT }, "readyForReview", null],
		["back to draft", { __typename: "ConvertToDraftEvent", ...EVENT }, "convertedToDraft", null],
		[
			"review requested from a person",
			{ __typename: "ReviewRequestedEvent", ...EVENT, requestedReviewer: { __typename: "User", login: "reviewer-one" } },
			"reviewRequested",
			"reviewer-one",
		],
		["review requested from a team", { __typename: "ReviewRequestedEvent", ...EVENT, requestedReviewer: { __typename: "Team", name: "Core" } }, "reviewRequested", "Core"],
		["labeled", { __typename: "LabeledEvent", ...EVENT, label: { name: "bug" } }, "labeled", "bug"],
		["unlabeled", { __typename: "UnlabeledEvent", ...EVENT, label: { name: "bug" } }, "unlabeled", "bug"],
		["force-pushed", { __typename: "HeadRefForcePushedEvent", ...EVENT }, "headRefForcePushed", null],
		["renamed", { __typename: "RenamedTitleEvent", ...EVENT, currentTitle: "New title" }, "renamed", "New title"],
	])("maps the %s event", (_label: string, node: GithubTimelineNodeWire, kind: string, detail: string | null) => {
		expect(toTimelineItem(node, AS_GITHUB_SERVES)).toEqual({
			type: "event",
			kind,
			actor: { login: "maintainer", avatarUrl: "https://avatars.githubusercontent.com/maintainer" },
			createdAt: CREATED_AT_MS,
			detail,
		});
	});

	it("cuts a long event detail to the contract's limit", () => {
		const item = toTimelineItem({ __typename: "RenamedTitleEvent", ...EVENT, currentTitle: "x".repeat(GITHUB_TIMELINE_EVENT_DETAIL_MAX_LENGTH + 10) }, AS_GITHUB_SERVES);

		expect(item.type === "event" ? item.detail?.length : undefined).toBe(GITHUB_TIMELINE_EVENT_DETAIL_MAX_LENGTH);
	});

	it("pages the conversation", () => {
		const page = toTimelinePage({ pageInfo: { hasNextPage: false, endCursor: "end" }, nodes: [commentNodeWire()] }, AS_GITHUB_SERVES);

		expect(GithubTimelinePageSchema.parse(page)).toEqual(page);
		expect(page.nextCursor).toBeNull();
	});

	it("pages the commits with the same commit shape as the history", () => {
		const page = toPullRequestCommitPage({
			totalCount: 1,
			pageInfo: { hasNextPage: false, endCursor: null },
			nodes: [
				{
					commit: {
						oid: HEAD_SHA,
						abbreviatedOid: "4f2a9c1",
						messageHeadline: "Add screens",
						url: "https://github.com/octo-org/hello-world/commit/4f2a9c1",
						committedDate: CREATED_AT,
						additions: 10,
						deletions: 2,
						changedFilesIfAvailable: 3,
						author: { name: "Sam", user: actorWire("sam") },
					},
				},
			],
		});

		expect(page.items.at(0)).toMatchObject({ sha: HEAD_SHA, headline: "Add screens", additions: 10, changedFiles: 3, author: { login: "sam" } });
		expect(page.totalCount).toBe(1);
	});

	it("pages the files with the head commit, and names the next page", () => {
		const page = toPullRequestFilePage(
			{ files: [{ filename: "src/app.ts", status: "modified", additions: 1, deletions: 0, patch: "@@ -1 +1,2 @@\n a\n+b" }], hasNextPage: true },
			1,
			HEAD_SHA,
		);

		expect(page).toEqual({
			files: [{ path: "src/app.ts", previousPath: null, status: "modified", additions: 1, deletions: 0, diff: { kind: "patch", patch: "@@ -1 +1,2 @@\n a\n+b" } }],
			nextPage: 2,
			headSha: HEAD_SHA,
		});
		expect(toPullRequestFilePage({ files: [], hasNextPage: false }, 3, HEAD_SHA).nextPage).toBeNull();
	});

	it("maps line-comment threads and says when GitHub has more", () => {
		const list = toReviewThreadList(
			{ headRefOid: HEAD_SHA, reviewThreads: { totalCount: 5, nodes: [reviewThreadWire({ diffSide: "LEFT", isOutdated: true, line: null })] } },
			AS_GITHUB_SERVES,
		);

		expect(GithubReviewThreadListSchema.parse(list)).toEqual(list);
		expect(list.threads.at(0)).toMatchObject({ side: "left", isOutdated: true, line: null });
		expect(list.truncated).toBe(true);
	});

	it("lists a comment's versions newest first, keeping a removed version without its text", () => {
		const history = toContentEditHistory({
			totalCount: 2,
			nodes: [
				{ editedAt: UPDATED_AT, deletedAt: null, diff: "Second version", editor: actorWire() },
				{ editedAt: CREATED_AT, deletedAt: UPDATED_AT, diff: "Removed", editor: null },
				null,
			],
		});

		expect(GithubContentEditHistorySchema.parse(history)).toEqual(history);
		expect(history.edits).toEqual([
			{ editedAt: UPDATED_AT_MS, editor: { login: "octocat", avatarUrl: "https://avatars.githubusercontent.com/octocat" }, body: "Second version" },
			{ editedAt: CREATED_AT_MS, editor: null, body: null },
		]);
	});
});

describe("merge status mappers", () => {
	it("says a commit without checks has none, and checks GitHub would not show are unavailable", () => {
		expect(toChecks(null)).toEqual({ kind: "none" });
		expect(toChecks(undefined)).toEqual({ kind: "unavailable" });
	});

	it("counts check runs and commit statuses together, as GitHub's merge box buckets them", () => {
		const checks = toChecks({
			state: "FAILURE",
			contexts: {
				checkRunCountsByState: [
					{ state: "SUCCESS", count: 3 },
					{ state: "NEUTRAL", count: 1 },
					{ state: "SKIPPED", count: 2 },
					{ state: "TIMED_OUT", count: 1 },
					{ state: "IN_PROGRESS", count: 1 },
				],
				statusContextCountsByState: [
					{ state: "ERROR", count: 1 },
					{ state: "EXPECTED", count: 1 },
				],
			},
		});

		expect(checks).toEqual({ kind: "summary", state: "failure", successful: 4, failed: 2, pending: 2, skipped: 2 });
	});

	it("reads a rollup with no counts as zero of each", () => {
		expect(toChecks({ state: "SUCCESS", contexts: { checkRunCountsByState: null, statusContextCountsByState: null } })).toEqual({
			kind: "summary",
			state: "success",
			successful: 0,
			failed: 0,
			pending: 0,
			skipped: 0,
		});
	});

	it.each<[GithubMergeableWire, GithubMergeability]>([
		["MERGEABLE", "mergeable"],
		["CONFLICTING", "conflicting"],
		["UNKNOWN", "unknown"],
	])("maps %s to %s", (wire, mergeability) => {
		expect(toMergeability(wire)).toBe(mergeability);
	});
});

describe("write mappers", () => {
	it("maps a posted comment as the caller's own, never edited", () => {
		const comment = toPostedComment({
			id: 6186769145,
			node_id: "IC_new",
			user: { login: "octocat", avatar_url: "https://avatars.githubusercontent.com/u/1" },
			body: "Hi",
			created_at: "2026-10-15T08:00:00Z",
			html_url: "https://github.com/o/r/pull/1#issuecomment-1",
		});

		expect(comment).toMatchObject({ id: "IC_new", author: { login: "octocat" }, lastEditedAt: null, viewerCanUpdate: true, viewerDidAuthor: true });
		// GitHub's REST answer carries its numeric id: the new comment can be reacted to at once.
		expect(comment.reactionSubject).toEqual({ type: "issueComment", commentId: "6186769145" });
	});

	it("maps a submitted review, falling back to now when GitHub sends no submit time", () => {
		const review = toSubmittedReview(
			{ node_id: "PRR_new", user: null, body: null, state: "CHANGES_REQUESTED", submitted_at: null, html_url: "https://github.com/o/r/pull/1#pullrequestreview-1" },
			1_000,
		);

		expect(review).toMatchObject({ state: "changesRequested", body: "", author: null, submittedAt: null, createdAt: 1_000, comments: [], commentCount: 0 });
	});
});

describe("toMergeOptions", () => {
	it("lists only the methods the repository allows, and falls back to the first when GitHub's suggestion is not one of them", () => {
		const options = toMergeOptions(
			mergeStateWire({ mergeStateStatus: "BLOCKED" }, { mergeCommitAllowed: false, squashMergeAllowed: true, rebaseMergeAllowed: true, viewerDefaultMergeMethod: "MERGE" }),
		);

		expect(options).toMatchObject({ state: "blocked", methods: ["squash", "rebase"], defaultMethod: "squash" });
		expect(toMergeOptions(mergeStateWire({}, { viewerDefaultMergeMethod: null })).defaultMethod).toBe("merge");
	});

	it("never offers to delete a fork's branch, and says when the repository deletes branches itself", () => {
		expect(toMergeOptions(mergeStateWire({ isCrossRepository: true }, { deleteBranchOnMerge: true }))).toMatchObject({
			canDeleteHeadBranch: false,
			deletesBranchOnMerge: true,
		});
	});
});

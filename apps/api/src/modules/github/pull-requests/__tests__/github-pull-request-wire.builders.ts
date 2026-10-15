// Builders of GitHub's pull-request answers for the specs — each a valid wire
// shape with sensible defaults; override what the test is about.

import {
	GithubReactionContentWireSchema,
	type GithubActorWire,
	type GithubCommentWire,
	type GithubPullRequestDetailWire,
	type GithubMergeStateWire,
	type GithubPullRequestSummaryWire,
	type GithubReactionContentWire,
	type GithubReactionGroupsWire,
	type GithubReviewCommentWire,
	type GithubReviewNodeWire,
	type GithubReviewThreadWire,
	type GithubTimelineNodeWire,
} from "../github-pull-requests.wire-schemas";

export const OWNER = "octo-org";
export const REPOSITORY = "hello-world";
export const NUMBER = 42;
export const PULL_REQUEST = { owner: OWNER, repository: REPOSITORY, number: NUMBER };

export const CREATED_AT = "2026-10-01T08:00:00Z";
export const UPDATED_AT = "2026-10-02T09:30:00Z";
export const CREATED_AT_MS = Date.parse(CREATED_AT);
export const UPDATED_AT_MS = Date.parse(UPDATED_AT);

export const HEAD_SHA = "4f2a9c1d8e7b6a5f4e3d2c1b0a9f8e7d6c5b4a39";

export function actorWire(login = "octocat"): NonNullable<GithubActorWire> {
	return { login, avatarUrl: `https://avatars.githubusercontent.com/${login}` };
}

export function summaryWire(overrides: Partial<GithubPullRequestSummaryWire> = {}): GithubPullRequestSummaryWire {
	return {
		number: NUMBER,
		title: "Add pull request screens",
		state: "OPEN",
		isDraft: false,
		createdAt: CREATED_AT,
		updatedAt: UPDATED_AT,
		url: `https://github.com/${OWNER}/${REPOSITORY}/pull/${String(NUMBER)}`,
		reviewDecision: "REVIEW_REQUIRED",
		repository: { name: REPOSITORY, owner: { login: OWNER } },
		author: actorWire(),
		comments: { totalCount: 3 },
		labels: { nodes: [{ name: "enhancement", color: "a2eeef" }] },
		...overrides,
	};
}

/** All eight of GitHub's reaction groups, as it lists them: the given counts, the rest zero; `mine` the viewer chose. */
export function reactionGroupsWire(counts: Partial<Record<GithubReactionContentWire, number>>, mine: readonly GithubReactionContentWire[]): GithubReactionGroupsWire {
	return GithubReactionContentWireSchema.options.map((content: GithubReactionContentWire) => ({
		content,
		viewerHasReacted: mine.includes(content),
		reactors: { totalCount: counts[content] ?? 0 },
	}));
}

export function commentWire(overrides: Partial<GithubCommentWire> = {}): GithubCommentWire {
	return {
		id: "IC_kwDOAbCdEf5r1sT2",
		fullDatabaseId: "6186769145",
		author: actorWire("hubot"),
		body: "Looks good **overall**.",
		bodyHTML: '<p dir="auto">Looks good <strong>overall</strong>.</p>',
		reactionGroups: reactionGroupsWire({ HEART: 2 }, ["HEART"]),
		createdAt: CREATED_AT,
		lastEditedAt: null,
		viewerCanUpdate: false,
		viewerDidAuthor: false,
		url: `https://github.com/${OWNER}/${REPOSITORY}/pull/${String(NUMBER)}#issuecomment-1`,
		...overrides,
	};
}

export function reviewCommentWire(overrides: Partial<GithubReviewCommentWire> = {}): GithubReviewCommentWire {
	return {
		...commentWire({ id: "PRRC_kwDOAbCdEf5r1sT3" }),
		path: "src/app.ts",
		line: 12,
		originalLine: 12,
		diffHunk: "@@ -10,3 +10,4 @@\n const a = 1;\n+const b = 2;",
		...overrides,
	};
}

export function reviewNodeWire(overrides: Partial<GithubReviewNodeWire> = {}): GithubReviewNodeWire {
	return {
		...commentWire({ id: "PRR_kwDOAbCdEf5r1sT4", body: "Please rename this." }),
		__typename: "PullRequestReview",
		state: "CHANGES_REQUESTED",
		submittedAt: UPDATED_AT,
		comments: { totalCount: 1, nodes: [reviewCommentWire()] },
		...overrides,
	};
}

export function commentNodeWire(overrides: Partial<GithubCommentWire> = {}): GithubTimelineNodeWire {
	return { ...commentWire(overrides), __typename: "IssueComment" };
}

export function detailWire(overrides: Partial<GithubPullRequestDetailWire> = {}): GithubPullRequestDetailWire {
	return {
		...summaryWire(),
		id: "PR_kwDOAbCdEf5r1sT1",
		body: "Adds the **pull request** screens.",
		bodyHTML: '<p dir="auto">Adds the <strong>pull request</strong> screens.</p>',
		reactionGroups: reactionGroupsWire({ THUMBS_UP: 1, ROCKET: 3 }, []),
		lastEditedAt: null,
		baseRefName: "main",
		headRefName: "feature/pull-requests",
		isCrossRepository: false,
		headRepositoryOwner: { login: OWNER },
		additions: 120,
		deletions: 8,
		changedFiles: 5,
		commits: { totalCount: 3 },
		mergedAt: null,
		closedAt: null,
		viewerDidAuthor: false,
		viewerCanUpdate: true,
		reviewRequests: {
			nodes: [
				{ requestedReviewer: { __typename: "User", login: "reviewer-one", avatarUrl: "https://avatars.githubusercontent.com/reviewer-one" } },
				{ requestedReviewer: { __typename: "Team" } },
			],
		},
		timelineItems: { pageInfo: { hasNextPage: true, endCursor: "Y3Vyc29yOjE=" }, nodes: [commentNodeWire(), reviewNodeWire()] },
		...overrides,
	};
}

export function reviewThreadWire(overrides: Partial<GithubReviewThreadWire> = {}): GithubReviewThreadWire {
	return {
		id: "PRRT_kwDOAbCdEf5r1sT5",
		path: "src/app.ts",
		line: 12,
		originalLine: 12,
		diffSide: "RIGHT",
		isResolved: false,
		isOutdated: false,
		comments: { nodes: [reviewCommentWire()] },
		...overrides,
	};
}

/** A repository allowing every merge method, with an open pull request whose branch merges cleanly. */
export function mergeStateWire(
	pullRequest: Partial<GithubMergeStateWire["pullRequest"]> = {},
	repository: Partial<Omit<GithubMergeStateWire, "pullRequest">> = {},
): GithubMergeStateWire {
	return {
		mergeCommitAllowed: true,
		squashMergeAllowed: true,
		rebaseMergeAllowed: true,
		deleteBranchOnMerge: false,
		viewerDefaultMergeMethod: "SQUASH",
		...repository,
		pullRequest: { mergeable: "MERGEABLE", mergeStateStatus: "CLEAN", headRefOid: HEAD_SHA, headRefName: "feature/pull-requests", isCrossRepository: false, ...pullRequest },
	};
}

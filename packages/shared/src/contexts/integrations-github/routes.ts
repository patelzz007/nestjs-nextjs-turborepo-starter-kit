// API path templates owned by the `integrations-github` context. Composed into `apiRoutes`
// (`src/api-routes.ts`) with identical keys and values.

import type { RouteTree } from "../../route-tree";

// ── GitHub contributions (read-only, server-configured repositories) ──

/** Path templates composed into `apiRoutes.github`. */
export const githubRoutes = {
	repositories: "/github/repositories",
	repositorySummary: "/github/repositories/:owner/:repository",
	repositoryCommits: "/github/repositories/:owner/:repository/commits",
	repositoryCommit: "/github/repositories/:owner/:repository/commits/:sha",
	repositoryContributors: "/github/repositories/:owner/:repository/contributors",
} satisfies Record<string, RouteTree>;

// ── GitHub pull requests (each admin's own linked token — ADR 052) ──

/** Path templates composed into `apiRoutes.githubPullRequests`. */
export const githubPullRequestsRoutes = {
	account: "/github/account",
	list: "/github/pull-requests",
	detail: "/github/pull-requests/:owner/:repository/:number",
	timeline: "/github/pull-requests/:owner/:repository/:number/timeline",
	commits: "/github/pull-requests/:owner/:repository/:number/commits",
	commit: "/github/pull-requests/:owner/:repository/:number/commits/:sha",
	comments: "/github/pull-requests/:owner/:repository/:number/comments",
	reviews: "/github/pull-requests/:owner/:repository/:number/reviews",
	reactions: "/github/pull-requests/:owner/:repository/:number/reactions",
	pictures: "/github/pull-requests/:owner/:repository/:number/pictures",
	merge: "/github/pull-requests/:owner/:repository/:number/merge",
	events: "/github/pull-requests/events",
	liveUpdates: "/github/live-updates/:owner/:repository",
	status: "/github/pull-requests/:owner/:repository/:number/status",
	files: "/github/pull-requests/:owner/:repository/:number/files",
	reviewThreads: "/github/pull-requests/:owner/:repository/:number/review-threads",
	contentEdits: "/github/content-edits/:nodeId",
} satisfies Record<string, RouteTree>;

// ── Pictures GitHub shows only to signed-in readers, for the app (ADR 052) ──

/** Path templates composed into `apiRoutes.githubPictures`. */
export const githubPicturesRoutes = {
	file: "/github/pictures/file",
	upload: "/github/pictures/uploads/:attachmentId",
} satisfies Record<string, RouteTree>;

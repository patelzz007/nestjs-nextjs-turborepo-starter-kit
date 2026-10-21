// ============================================
// contexts/integrations-github — the context's public surface
// ============================================
// GitHub integration — the linked account, contributions, commits and pull requests.
// Code outside this folder (routes in src/app, runtime features, screen tests)
// imports from here, never from a file inside it
// (docs/architecture/ddd-cqrs-migration-plan.md §14.5).

export { COMMIT_SHA_COPIED_MESSAGE, GithubCommitDetailScreen } from "./github/github-commit-detail";
export { GithubContributionsSection } from "./github/github-contributions-section";
export { commitScreenTitle, MORE_FILES_ON_GITHUB } from "./github/labels";
export { refreshGithubContributions } from "./github/refresh";
export { EDIT_HISTORY_TITLE } from "./pull-requests/edit-history-sheet";
export { GITHUB_NEW_TOKEN_URL } from "@workspace/shared";
export { GithubAccountScreen } from "./pull-requests/github-account-screen";
export { useGithubPullRequestAccess } from "./pull-requests/github-pull-request-access";
export {
	accountRowValue,
	COMMENT_POSTED_MESSAGE,
	COMMITS_TITLE,
	FILES_CHANGED_TITLE,
	GITHUB_ACCOUNT_TITLE,
	INVALID_PULL_REQUEST_LINK_MESSAGE,
	NO_PULL_REQUESTS_MESSAGE,
	OWN_PULL_REQUEST_REVIEW_NOTE,
	PULL_REQUESTS_TITLE,
	pullRequestScreenTitle,
	REVIEW_SUBMITTED_MESSAGE,
	TOKEN_LINKED_MESSAGE,
	TOKEN_UNLINKED_MESSAGE,
} from "./pull-requests/labels";
export { LIVE_UPDATES_ON_DETAIL } from "./pull-requests/live-updates-row";
export { PullRequestCommitScreen } from "./pull-requests/pull-request-commit-screen";
export { PullRequestCommitsScreen } from "./pull-requests/pull-request-commits-screen";
export { MORE_THREADS_ON_GITHUB, PullRequestFilesScreen } from "./pull-requests/pull-request-files-screen";
export { PullRequestListScreen } from "./pull-requests/pull-request-list-screen";
export { PullRequestCommitRoute, PullRequestRoute } from "./pull-requests/pull-request-route";
export { PullRequestScreen } from "./pull-requests/pull-request-screen";

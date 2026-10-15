// The words of the pull-request screens (ADR 052), in GitHub's own phrasing so
// they read the way GitHub's app reads: "octocat wants to merge 3 commits into
// main from feature", "requested changes", "added the bug label". Pure, so
// tested without rendering.

import {
	assertNever,
	type GithubAccountStatus,
	type GithubChecks,
	type GithubMergeability,
	type GithubMergeMethod,
	type GithubMergeResult,
	type GithubMergeState,
	type GithubActor,
	type GithubPullRequestDetail,
	type GithubPullRequestFilter,
	type GithubPullRequestState,
	type GithubPullRequestStateFilter,
	type GithubPullRequestSummary,
	type GithubReviewDecision,
	type GithubReviewEvent,
	type GithubReviewState,
	type GithubTimelineEventKind,
} from "@workspace/shared";

import { formatDateTime, formatRelativeTime } from "../../lib/time-format";
import { countOf } from "../github/labels";

/** What GitHub shows for an account it no longer knows. */
export const GHOST_LOGIN = "ghost";

export const PULL_REQUESTS_TITLE = "Pull requests";
export const FILES_CHANGED_TITLE = "Files changed";
export const COMMITS_TITLE = "Commits";
export const GITHUB_ACCOUNT_TITLE = "GitHub token";

/** The list's filters, as GitHub's own app names its inbox. */
export const PULL_REQUEST_FILTER_LABELS: Readonly<Record<GithubPullRequestFilter, string>> = {
	yours: "Your repositories",
	created: "Created by you",
	reviewRequested: "Review requests",
	assigned: "Assigned to you",
	mentioned: "Mentioning you",
};

export const PULL_REQUEST_STATE_FILTER_LABELS: Readonly<Record<GithubPullRequestStateFilter, string>> = {
	open: "Open",
	closed: "Closed",
};

/** What a pill says: a draft is shown as one while it is open; merged is told apart from closed. */
export type PullRequestDisplayState = "open" | "draft" | "merged" | "closed";

export function displayStateOf(pullRequest: Pick<GithubPullRequestSummary, "state" | "isDraft">): PullRequestDisplayState {
	if (pullRequest.state === "open") {
		return pullRequest.isDraft ? "draft" : "open";
	}
	return pullRequest.state;
}

export const DISPLAY_STATE_LABELS: Readonly<Record<PullRequestDisplayState, string>> = {
	open: "Open",
	draft: "Draft",
	merged: "Merged",
	closed: "Closed",
};

/** `octo-org/hello-world #42`. */
export function pullRequestReference(pullRequest: Pick<GithubPullRequestSummary, "owner" | "repository" | "number">): string {
	return `${pullRequest.owner}/${pullRequest.repository} #${String(pullRequest.number)}`;
}

/** The header title of a pull request's screen: `hello-world #42`, or `Pull request` when the link names none. */
export function pullRequestScreenTitle(repository: string | null, number: number | null): string {
	return repository === null || number === null ? "Pull request" : `${repository} #${String(number)}`;
}

/** An actor's login, or GitHub's "ghost" for a deleted account. */
export function loginOf(actor: GithubActor | null): string {
	return actor?.login ?? GHOST_LOGIN;
}

/** A list row's second line: "#42 opened 2 days ago by octocat" (or "merged" / "closed" once it is). */
export function listRowMeta(pullRequest: GithubPullRequestSummary, nowMs: number): string {
	return `#${String(pullRequest.number)} opened ${formatRelativeTime(pullRequest.createdAt, nowMs)} by ${loginOf(pullRequest.author)}`;
}

const STATE_VERBS: Readonly<Record<GithubPullRequestState, string>> = {
	open: "wants to merge",
	merged: "merged",
	closed: "wanted to merge",
};

/** "octocat wants to merge 3 commits into main from feature/x" — from a fork, the branch is owner:branch. */
export function mergeSummary(detail: GithubPullRequestDetail): string {
	const head = detail.headOwner === null ? detail.headRef : `${detail.headOwner}:${detail.headRef}`;
	return `${loginOf(detail.author)} ${STATE_VERBS[detail.state]} ${countOf(detail.commitCount, "commit", "commits")} into ${detail.baseRef} from ${head}`;
}

const REVIEW_DECISION_LABELS: Readonly<Record<GithubReviewDecision, string>> = {
	approved: "Changes approved",
	changesRequested: "Changes requested",
	reviewRequired: "Review required",
};

export function reviewDecisionLabel(decision: GithubReviewDecision | null): string | null {
	return decision === null ? null : REVIEW_DECISION_LABELS[decision];
}

/** "commented 2 hours ago" — after the author's name. */
export function commentedLabel(createdAt: number, nowMs: number): string {
	return `commented ${formatRelativeTime(createdAt, nowMs)}`;
}

const REVIEW_VERBS: Readonly<Record<GithubReviewState, string>> = {
	approved: "approved these changes",
	changesRequested: "requested changes",
	commented: "reviewed",
	dismissed: "reviewed (dismissed)",
	pending: "started a review",
};

/** "approved these changes 3 hours ago". */
export function reviewedLabel(state: GithubReviewState, at: number, nowMs: number): string {
	return `${REVIEW_VERBS[state]} ${formatRelativeTime(at, nowMs)}`;
}

/** What an event says after the actor's name: "closed this", "added the bug label". */
export function eventSentence(kind: GithubTimelineEventKind, detail: string | null): string {
	switch (kind) {
		case "closed":
			return "closed this";
		case "reopened":
			return "reopened this";
		case "merged":
			return detail === null ? "merged this" : `merged this into ${detail}`;
		case "readyForReview":
			return "marked this pull request as ready for review";
		case "convertedToDraft":
			return "marked this pull request as draft";
		case "reviewRequested":
			return detail === null ? "requested a review" : `requested a review from ${detail}`;
		case "labeled":
			return detail === null ? "added a label" : `added the ${detail} label`;
		case "unlabeled":
			return detail === null ? "removed a label" : `removed the ${detail} label`;
		case "headRefForcePushed":
			return "force-pushed the branch";
		case "renamed":
			return detail === null ? "changed the title" : `changed the title to ${detail}`;
		default:
			return assertNever(kind, "timeline event");
	}
}

/** The "edited" marker in a comment's header (its history opens from it); `null` for a comment never edited. */
export function editedLabel(lastEditedAt: number | null): string | null {
	return lastEditedAt === null ? null : "edited";
}

/** "Edited 2 hours ago by octocat" — one version in an edit history. */
export function editEntryLabel(editor: GithubActor | null, editedAt: number, nowMs: number): string {
	return `${loginOf(editor)} edited ${formatRelativeTime(editedAt, nowMs)}`;
}

/** "Files changed" row value: "5 files". */
export function filesChangedLabel(count: number): string {
	return countOf(count, "file", "files");
}

/** What the token screen says about the link. */
export function accountSummary(status: GithubAccountStatus, nowMs: number): string {
	switch (status.status) {
		case "off":
			return "Pull requests are not set up on this server.";
		case "unlinked":
			return "Link a fine-grained GitHub token to see and work on your pull requests.";
		case "linked":
			if (status.health === "rejected") {
				return `GitHub no longer accepts the token of ${status.login}. Link a new one to continue.`;
			}
			return status.tokenExpiresAt === null
				? `Linked as ${status.login} ${formatRelativeTime(status.linkedAt, nowMs)}. The token does not expire.`
				: `Linked as ${status.login}. The token expires ${formatDateTime(status.tokenExpiresAt)}.`;
		default:
			return assertNever(status, "GitHub account status");
	}
}

/** The drawer row's value for the token: "Linked", "Not linked", "Needs a new token". */
export function accountRowValue(status: GithubAccountStatus): string | undefined {
	switch (status.status) {
		case "off":
			return undefined;
		case "unlinked":
			return "Not linked";
		case "linked":
			return status.health === "rejected" ? "Needs a new token" : "Linked";
		default:
			return assertNever(status, "GitHub account status");
	}
}

/** The fine-grained token permissions the API needs (ADR 052), as GitHub's settings page names them. */
export const REQUIRED_TOKEN_PERMISSIONS: readonly string[] = [
	"Pull requests: Read and write",
	"Contents: Read and write (to attach pictures)",
	"Metadata: Read-only",
	"Webhooks: Read and write (for live updates)",
];

export const NO_PULL_REQUESTS_MESSAGE = "No pull requests here.";
export const INVALID_PULL_REQUEST_LINK_MESSAGE = "This link doesn't point to a pull request. Go back and pick one from the list.";
export const INVALID_PULL_REQUEST_COMMIT_LINK_MESSAGE = "This link doesn't point to a commit. Go back and pick one from the pull request's commits.";
export const TOKEN_LINKED_MESSAGE = "GitHub token linked.";
export const TOKEN_UNLINKED_MESSAGE = "GitHub token removed.";

export const COMMENT_POSTED_MESSAGE = "Comment posted to GitHub.";
export const REVIEW_SUBMITTED_MESSAGE = "Review submitted to GitHub.";
export const OWN_PULL_REQUEST_REVIEW_NOTE = "This is your pull request, so GitHub lets you comment on it but not approve it or request changes.";

export interface ReviewEventOption {
	readonly value: GithubReviewEvent;
	readonly label: string;
	readonly description: string;
}

/** "Review changes", in GitHub's own words. */
export const REVIEW_EVENT_OPTIONS: readonly ReviewEventOption[] = [
	{ value: "comment", label: "Comment", description: "Submit general feedback without explicit approval." },
	{ value: "approve", label: "Approve", description: "Submit feedback and approve merging these changes." },
	{ value: "requestChanges", label: "Request changes", description: "Submit feedback that must be addressed before merging." },
];

/** The badge on a comment by the pull request's author, as GitHub shows it. */
export const AUTHOR_BADGE = "Author";

/** One row of the merge box: a headline, the detail under it, and how it reads (never by colour alone — each tone has its own glyph). */
export interface MergeBoxLine {
	readonly tone: "success" | "danger" | "attention";
	readonly title: string;
	readonly detail: string;
}

/** "3 successful checks", "1 failing, 2 successful checks" — only the buckets that have any. */
function checkCounts(checks: Extract<GithubChecks, { readonly kind: "summary" }>): string {
	const parts = [
		checks.failed > 0 ? `${String(checks.failed)} failing` : null,
		checks.pending > 0 ? `${String(checks.pending)} pending` : null,
		checks.successful > 0 ? `${String(checks.successful)} successful` : null,
		checks.skipped > 0 ? `${String(checks.skipped)} skipped` : null,
	].filter((part: string | null): part is string => part !== null);
	const total = checks.failed + checks.pending + checks.successful + checks.skipped;
	return parts.length === 0 ? "No checks reported yet" : `${parts.join(", ")} ${total === 1 ? "check" : "checks"}`;
}

/** The checks row in GitHub's words; `null` when the head commit has no checks (GitHub shows no row then). */
export function checksLine(checks: GithubChecks): MergeBoxLine | null {
	switch (checks.kind) {
		case "none":
			return null;
		case "unavailable":
			return { tone: "attention", title: "Checks aren't visible to your token", detail: "GitHub didn't show this pull request's checks to your GitHub token." };
		case "summary":
			switch (checks.state) {
				case "success":
					return { tone: "success", title: "All checks have passed", detail: checkCounts(checks) };
				case "failure":
					return { tone: "danger", title: "Some checks were not successful", detail: checkCounts(checks) };
				case "pending":
					return { tone: "attention", title: "Some checks haven't completed yet", detail: checkCounts(checks) };
				default:
					return assertNever(checks.state, "checks state");
			}
		default:
			return assertNever(checks, "checks");
	}
}

/** The conflicts row in GitHub's words. */
export function mergeabilityLine(mergeability: GithubMergeability): MergeBoxLine {
	switch (mergeability) {
		case "mergeable":
			return { tone: "success", title: "No conflicts with base branch", detail: "Merging can be performed automatically." };
		case "conflicting":
			return { tone: "danger", title: "This branch has conflicts that must be resolved", detail: "Resolve the conflicts on GitHub or locally before merging." };
		case "unknown":
			return { tone: "attention", title: "Checking for the ability to merge automatically", detail: "GitHub is still working this out. Pull to refresh in a moment." };
		default:
			return assertNever(mergeability, "mergeability");
	}
}

/** The review row in GitHub's words; `null` when the repository requires no review. */
export function reviewLine(decision: GithubReviewDecision | null): MergeBoxLine | null {
	switch (decision) {
		case null:
			return null;
		case "approved":
			return { tone: "success", title: "Changes approved", detail: "This pull request has the approving reviews it needs." };
		case "changesRequested":
			return { tone: "danger", title: "Changes requested", detail: "A reviewer asked for changes before this can merge." };
		case "reviewRequired":
			return { tone: "attention", title: "Review required", detail: "At least one approving review is needed before merging." };
		default:
			return assertNever(decision, "review decision");
	}
}

// ── Merging ─────────────────────────────────────────────────────────────────

/** GitHub's three ways to merge, in its own words. */
export const MERGE_METHOD_LABELS: Readonly<Record<GithubMergeMethod, { readonly label: string; readonly description: string; readonly confirm: string }>> = {
	merge: { label: "Create a merge commit", description: "All commits from this branch are added to the base branch via a merge commit.", confirm: "Confirm merge" },
	squash: { label: "Squash and merge", description: "The commits from this branch are combined into one commit in the base branch.", confirm: "Confirm squash and merge" },
	rebase: { label: "Rebase and merge", description: "The commits from this branch are rebased and added to the base branch.", confirm: "Confirm rebase and merge" },
};

/** The commit title GitHub suggests for a method (a rebase makes no commit of its own). */
export function defaultMergeTitle(
	method: GithubMergeMethod,
	pullRequest: { readonly number: number; readonly title: string; readonly headOwner: string; readonly headBranch: string },
): string {
	switch (method) {
		case "merge":
			return `Merge pull request #${String(pullRequest.number)} from ${pullRequest.headOwner}/${pullRequest.headBranch}`;
		case "squash":
			return `${pullRequest.title} (#${String(pullRequest.number)})`;
		case "rebase":
			return "";
	}
}

/** Why the merge button is not offered right now, or `null` when it is. */
export function mergeUnavailableReason(state: GithubMergeState, mergeability: GithubMergeability, methods: readonly GithubMergeMethod[]): string | null {
	if (methods.length === 0) {
		return "This repository allows no merge method.";
	}
	if (state === "draft") {
		return "This pull request is still a draft.";
	}
	if (state === "dirty" || mergeability === "conflicting") {
		return "Resolve the conflicts on GitHub before merging.";
	}
	return null;
}

/** What a merge did, in words, for the toast. */
export function mergedMessage(result: GithubMergeResult, branch: string): string {
	switch (result.branch.outcome) {
		case "deleted":
			return `Pull request merged and branch ${branch} deleted.`;
		case "kept":
		case "failed":
			return "Pull request merged.";
	}
}

import { GithubAccountStatusSchema, GithubPullRequestDetailSchema, GithubPullRequestSummarySchema, type GithubTimelineEventKind } from "@workspace/shared";

import { NOW_MS, githubAccountLinkedJson, githubPullRequestDetailJson, githubPullRequestJson } from "../../../test/fixtures";
import {
	accountRowValue,
	accountSummary,
	checksLine,
	mergeabilityLine,
	reviewLine,
	commentedLabel,
	displayStateOf,
	editedLabel,
	editEntryLabel,
	eventSentence,
	filesChangedLabel,
	GHOST_LOGIN,
	listRowMeta,
	loginOf,
	mergeSummary,
	pullRequestReference,
	pullRequestScreenTitle,
	reviewDecisionLabel,
	reviewedLabel,
} from "./labels";

const HOUR_MS = 3_600_000;
const OCTOCAT = { login: "octocat", avatarUrl: null };

describe("pull request labels", () => {
	it("shows an open draft as a draft, and merged apart from closed", () => {
		expect(displayStateOf({ state: "open", isDraft: false })).toBe("open");
		expect(displayStateOf({ state: "open", isDraft: true })).toBe("draft");
		expect(displayStateOf({ state: "merged", isDraft: true })).toBe("merged");
		expect(displayStateOf({ state: "closed", isDraft: false })).toBe("closed");
	});

	it("names a pull request the way GitHub does", () => {
		expect(pullRequestReference({ owner: "octo-org", repository: "hello-world", number: 42 })).toBe("octo-org/hello-world #42");
		expect(pullRequestScreenTitle("hello-world", 42)).toBe("hello-world #42");
		expect(pullRequestScreenTitle(null, 42)).toBe("Pull request");
		expect(pullRequestScreenTitle("hello-world", null)).toBe("Pull request");
	});

	it("shows a deleted account as GitHub's ghost", () => {
		expect(loginOf(OCTOCAT)).toBe("octocat");
		expect(loginOf(null)).toBe(GHOST_LOGIN);
	});

	it("says who opened a list row and when", () => {
		const pullRequest = GithubPullRequestSummarySchema.parse(githubPullRequestJson(7));
		expect(listRowMeta(pullRequest, NOW_MS)).toBe("#7 opened 1 hour ago by octocat");
		expect(listRowMeta({ ...pullRequest, author: null }, NOW_MS)).toBe("#7 opened 1 hour ago by ghost");
	});

	it("says what merges where, with a fork's owner on its branch", () => {
		const detail = GithubPullRequestDetailSchema.parse(githubPullRequestDetailJson());
		expect(mergeSummary(detail)).toBe("octocat wants to merge 3 commits into main from feature/login");
		expect(mergeSummary({ ...detail, state: "merged", commitCount: 1 })).toBe("octocat merged 1 commit into main from feature/login");
		expect(mergeSummary({ ...detail, state: "closed", headOwner: "forker" })).toBe("octocat wanted to merge 3 commits into main from forker:feature/login");
	});

	it("words the review decision, or nothing when no review is required", () => {
		expect(reviewDecisionLabel("approved")).toBe("Changes approved");
		expect(reviewDecisionLabel("changesRequested")).toBe("Changes requested");
		expect(reviewDecisionLabel("reviewRequired")).toBe("Review required");
		expect(reviewDecisionLabel(null)).toBeNull();
	});

	it("words comments, reviews and edits with when they happened", () => {
		expect(commentedLabel(NOW_MS - HOUR_MS, NOW_MS)).toBe("commented 1 hour ago");
		expect(reviewedLabel("approved", NOW_MS - HOUR_MS, NOW_MS)).toBe("approved these changes 1 hour ago");
		expect(reviewedLabel("changesRequested", NOW_MS - HOUR_MS, NOW_MS)).toBe("requested changes 1 hour ago");
		expect(reviewedLabel("commented", NOW_MS - HOUR_MS, NOW_MS)).toBe("reviewed 1 hour ago");
		expect(reviewedLabel("dismissed", NOW_MS - HOUR_MS, NOW_MS)).toBe("reviewed (dismissed) 1 hour ago");
		expect(reviewedLabel("pending", NOW_MS - HOUR_MS, NOW_MS)).toBe("started a review 1 hour ago");
		expect(editedLabel(null)).toBeNull();
		expect(editedLabel(NOW_MS)).toBe("edited");
		expect(editEntryLabel(OCTOCAT, NOW_MS - HOUR_MS, NOW_MS)).toBe("octocat edited 1 hour ago");
		expect(editEntryLabel(null, NOW_MS - HOUR_MS, NOW_MS)).toBe("ghost edited 1 hour ago");
	});

	it.each<[GithubTimelineEventKind, string | null, string]>([
		["closed", null, "closed this"],
		["reopened", null, "reopened this"],
		["merged", "main", "merged this into main"],
		["merged", null, "merged this"],
		["readyForReview", null, "marked this pull request as ready for review"],
		["convertedToDraft", null, "marked this pull request as draft"],
		["reviewRequested", "monalisa", "requested a review from monalisa"],
		["reviewRequested", null, "requested a review"],
		["labeled", "bug", "added the bug label"],
		["labeled", null, "added a label"],
		["unlabeled", "bug", "removed the bug label"],
		["unlabeled", null, "removed a label"],
		["headRefForcePushed", null, "force-pushed the branch"],
		["renamed", "New title", "changed the title to New title"],
		["renamed", null, "changed the title"],
	])("words a %s event (detail %s)", (kind: GithubTimelineEventKind, detail: string | null, sentence: string) => {
		expect(eventSentence(kind, detail)).toBe(sentence);
	});

	it("counts changed files", () => {
		expect(filesChangedLabel(1)).toBe("1 file");
		expect(filesChangedLabel(5)).toBe("5 files");
	});

	it("describes the token link for its screen and its drawer row", () => {
		const off = GithubAccountStatusSchema.parse({ status: "off" });
		const unlinked = GithubAccountStatusSchema.parse({ status: "unlinked" });
		const linked = GithubAccountStatusSchema.parse(githubAccountLinkedJson());
		const rejected = GithubAccountStatusSchema.parse(githubAccountLinkedJson("rejected"));

		expect(accountSummary(off, NOW_MS)).toBe("Pull requests are not set up on this server.");
		expect(accountSummary(unlinked, NOW_MS)).toBe("Link a fine-grained GitHub token to see and work on your pull requests.");
		expect(accountSummary(linked, NOW_MS)).toBe("Linked as octocat 1 hour ago. The token does not expire.");
		expect(accountSummary(rejected, NOW_MS)).toBe("GitHub no longer accepts the token of octocat. Link a new one to continue.");
		const expiring = GithubAccountStatusSchema.parse({ ...githubAccountLinkedJson(), tokenExpiresAt: NOW_MS });
		expect(accountSummary(expiring, NOW_MS)).toMatch(/^Linked as octocat\. The token expires .+\.$/);

		expect(accountRowValue(off)).toBeUndefined();
		expect(accountRowValue(unlinked)).toBe("Not linked");
		expect(accountRowValue(linked)).toBe("Linked");
		expect(accountRowValue(rejected)).toBe("Needs a new token");
	});
});

describe("merge box lines", () => {
	it("words the checks as GitHub does, counting only the buckets that have any", () => {
		expect(checksLine({ kind: "none" })).toBeNull();
		expect(checksLine({ kind: "unavailable" })).toMatchObject({ tone: "attention", title: "Checks aren't visible to your token" });
		expect(checksLine({ kind: "summary", state: "success", successful: 1, failed: 0, pending: 0, skipped: 0 })).toEqual({
			tone: "success",
			title: "All checks have passed",
			detail: "1 successful check",
		});
		expect(checksLine({ kind: "summary", state: "pending", successful: 2, failed: 0, pending: 1, skipped: 0 })).toEqual({
			tone: "attention",
			title: "Some checks haven't completed yet",
			detail: "1 pending, 2 successful checks",
		});
		expect(checksLine({ kind: "summary", state: "pending", successful: 0, failed: 0, pending: 0, skipped: 0 })?.detail).toBe("No checks reported yet");
	});

	it("words mergeability and the review decision", () => {
		expect(mergeabilityLine("mergeable").title).toBe("No conflicts with base branch");
		expect(mergeabilityLine("conflicting").tone).toBe("danger");
		expect(mergeabilityLine("unknown").tone).toBe("attention");
		expect(reviewLine(null)).toBeNull();
		expect(reviewLine("approved")?.title).toBe("Changes approved");
		expect(reviewLine("changesRequested")?.tone).toBe("danger");
		expect(reviewLine("reviewRequired")?.title).toBe("Review required");
	});
});

import type { GithubReactionSubject, MergeGithubPullRequestInput } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { CommentOnPullRequestCommand } from "../commands/comment-on-pull-request/comment-on-pull-request.command";
import { CommentOnPullRequestHandler } from "../commands/comment-on-pull-request/comment-on-pull-request.handler";
import { MergePullRequestCommand } from "../commands/merge-pull-request/merge-pull-request.command";
import { MergePullRequestHandler } from "../commands/merge-pull-request/merge-pull-request.handler";
import { SetPullRequestReactionCommand } from "../commands/set-pull-request-reaction/set-pull-request-reaction.command";
import { SetPullRequestReactionHandler } from "../commands/set-pull-request-reaction/set-pull-request-reaction.handler";
import { SubmitPullRequestReviewCommand } from "../commands/submit-pull-request-review/submit-pull-request-review.command";
import { SubmitPullRequestReviewHandler } from "../commands/submit-pull-request-review/submit-pull-request-review.handler";
import { GithubAccountNotLinkedError, GithubLinkedTokenRejectedError, GithubPictureUnavailableError, GithubWriteRejectedError } from "../errors/github.errors";
import { HEAD_SHA, MERGE_SHA, POSTED_COMMENT, PULL_REQUEST, USER_ID, userActor } from "./fakes/github-contract.fixtures";
import { tokenRejected } from "./fakes/github-fakes";
import { githubHarness, LINKED_TOKEN, linkToken, type GithubHarness } from "./fakes/github-harness";

const PULL_REQUEST_KEY = "octo-org/hello-world#42";
const UPLOAD_ID = "cb5fe4d3-85fb-4d1e-807a-1771925051be";
const PICTURE_PATH = `pull-requests/42/${UPLOAD_ID}.png`;
const PICTURE_ADDRESS = `https://github.com/octo-org/hello-world/raw/github-comment-assets/${PICTURE_PATH}`;

function comment(harness: GithubHarness): CommentOnPullRequestHandler {
	return new CommentOnPullRequestHandler(harness.credentials, harness.writes, harness.cache, harness.pictures);
}

function review(harness: GithubHarness): SubmitPullRequestReviewHandler {
	return new SubmitPullRequestReviewHandler(harness.credentials, harness.writes, harness.cache, harness.pictures);
}

function merge(harness: GithubHarness): MergePullRequestHandler {
	return new MergePullRequestHandler(harness.credentials, harness.writes, harness.cache);
}

async function linked(): Promise<GithubHarness> {
	const harness = githubHarness();
	await linkToken(harness);
	return harness;
}

const MERGE: MergeGithubPullRequestInput = { method: "squash", expectedHeadSha: HEAD_SHA, commitTitle: "Add screens (#42)", commitMessage: "", deleteBranch: true };

describe("CommentOnPullRequestHandler", () => {
	it("comments as the caller and drops every cached view of the pull request", async () => {
		const harness = await linked();

		const posted = await comment(harness).execute(new CommentOnPullRequestCommand(userActor(), { params: PULL_REQUEST, comment: { body: "Thanks!" } }));

		expect(posted).toEqual({ ...POSTED_COMMENT, body: "Thanks!" });
		expect(harness.writes.writes).toEqual([{ kind: "comment", token: LINKED_TOKEN, detail: "Thanks!" }]);
		expect(harness.cache.pullRequests).toEqual([PULL_REQUEST_KEY]);
	});

	it("commits the caller's linked picture before posting, then deletes its upload", async () => {
		const harness = await linked();
		harness.uploads.add({ id: UPLOAD_ID, category: "GITHUB_COMMENT_IMAGE", uploadedById: USER_ID, status: "READY", extension: "png" });

		await comment(harness).execute(new CommentOnPullRequestCommand(userActor(), { params: PULL_REQUEST, comment: { body: `![shot](${PICTURE_ADDRESS})` } }));

		expect(harness.repositoryFiles.committed).toEqual([`${LINKED_TOKEN}:octo-org/hello-world:${PICTURE_PATH}`]);
		expect(harness.uploads.discarded).toEqual([`${UPLOAD_ID}:${USER_ID}`]);
		expect(harness.writes.writes).toHaveLength(1);
	});

	it("posts nothing when a linked picture is gone and was never committed, and keeps the cached views", async () => {
		const harness = await linked();

		await expect(
			comment(harness).execute(new CommentOnPullRequestCommand(userActor(), { params: PULL_REQUEST, comment: { body: `![shot](${PICTURE_ADDRESS})` } })),
		).rejects.toBeInstanceOf(GithubPictureUnavailableError);
		expect(harness.writes.writes).toEqual([]);
		expect(harness.cache.pullRequests).toEqual([]);
	});

	it("keeps the cached views when GitHub refuses the write", async () => {
		const harness = await linked();
		harness.writes.failures.set("comment", new GithubWriteRejectedError("forbidden", "", "octo-org/hello-world", "Pull requests"));

		await expect(comment(harness).execute(new CommentOnPullRequestCommand(userActor(), { params: PULL_REQUEST, comment: { body: "Hi" } }))).rejects.toBeInstanceOf(
			GithubWriteRejectedError,
		);
		expect(harness.cache.pullRequests).toEqual([]);
	});

	it("records a token GitHub refuses mid-write as rejected", async () => {
		const harness = await linked();
		harness.writes.failures.set("comment", tokenRejected());

		await expect(comment(harness).execute(new CommentOnPullRequestCommand(userActor(), { params: PULL_REQUEST, comment: { body: "Hi" } }))).rejects.toBeInstanceOf(
			GithubLinkedTokenRejectedError,
		);
		expect(harness.links.rows.get(USER_ID)?.status).toBe("REJECTED");
	});

	it("asks to link a token first", async () => {
		await expect(comment(githubHarness()).execute(new CommentOnPullRequestCommand(userActor(), { params: PULL_REQUEST, comment: { body: "Hi" } }))).rejects.toBeInstanceOf(
			GithubAccountNotLinkedError,
		);
	});
});

describe("SubmitPullRequestReviewHandler", () => {
	it("submits the review as the caller's account and drops the cached views", async () => {
		const harness = await linked();

		const submitted = await review(harness).execute(new SubmitPullRequestReviewCommand(userActor(), { params: PULL_REQUEST, review: { event: "approve", body: "" } }));

		expect(submitted).toMatchObject({ state: "approved", body: "" });
		expect(harness.writes.writes).toEqual([{ kind: "review", token: LINKED_TOKEN, detail: "approve:" }]);
		expect(harness.cache.pullRequests).toEqual([PULL_REQUEST_KEY]);
	});
});

describe("SetPullRequestReactionHandler", () => {
	it("sets the reaction as the caller and answers it as it now stands, dropping the cached views", async () => {
		const harness = await linked();
		const subject: GithubReactionSubject = { type: "issueComment", commentId: "6186769145" };

		const state = await new SetPullRequestReactionHandler(harness.credentials, harness.writes, harness.cache).execute(
			new SetPullRequestReactionCommand(userActor(), { params: PULL_REQUEST, reaction: { subject, content: "heart", reacted: false } }),
		);

		expect(state).toEqual({ subject, content: "heart", reacted: false });
		expect(harness.writes.writes).toEqual([{ kind: "reaction", token: LINKED_TOKEN, detail: "issueComment:heart:false" }]);
		expect(harness.cache.pullRequests).toEqual([PULL_REQUEST_KEY]);
	});
});

describe("MergePullRequestHandler", () => {
	it("merges as the caller pinned to the head they saw, deletes the branch, and drops the cached views", async () => {
		const harness = await linked();

		await expect(merge(harness).execute(new MergePullRequestCommand(userActor(), { params: PULL_REQUEST, merge: MERGE }))).resolves.toEqual({
			sha: MERGE_SHA,
			branch: { outcome: "deleted" },
		});
		expect(harness.writes.writes.map((write) => `${write.kind}:${write.detail}`)).toEqual([
			`merge:squash@${HEAD_SHA}:Add screens (#42)|`,
			"headBranch:",
			"deleteBranch:feature/parser",
		]);
		expect(harness.cache.pullRequests).toEqual([PULL_REQUEST_KEY]);
	});

	it("keeps the branch when not asked to delete it, without reading it", async () => {
		const harness = await linked();

		await expect(merge(harness).execute(new MergePullRequestCommand(userActor(), { params: PULL_REQUEST, merge: { ...MERGE, deleteBranch: false } }))).resolves.toEqual({
			sha: MERGE_SHA,
			branch: { outcome: "kept" },
		});
		expect(harness.writes.writes.map((write) => write.kind)).toEqual(["merge"]);
	});

	it("keeps a fork's branch: it is not this repository's to delete", async () => {
		const harness = await linked();
		harness.writes.head = { isCrossRepository: true, headRefName: "fork-branch" };

		await expect(merge(harness).execute(new MergePullRequestCommand(userActor(), { params: PULL_REQUEST, merge: MERGE }))).resolves.toMatchObject({
			branch: { outcome: "kept" },
		});
		expect(harness.writes.writes.map((write) => write.kind)).toEqual(["merge", "headBranch"]);
	});

	it("reports a branch GitHub would not delete, with GitHub's reason, without undoing the merge", async () => {
		const harness = await linked();
		harness.writes.failures.set("deleteBranch", new GithubWriteRejectedError("unprocessable", "Cannot delete this protected branch", "octo-org/hello-world", "Contents"));

		await expect(merge(harness).execute(new MergePullRequestCommand(userActor(), { params: PULL_REQUEST, merge: MERGE }))).resolves.toEqual({
			sha: MERGE_SHA,
			branch: { outcome: "failed", reason: "GitHub refused this: Cannot delete this protected branch" },
		});
		expect(harness.cache.pullRequests).toEqual([PULL_REQUEST_KEY]);
	});

	it("passes on any other failure deleting the branch", async () => {
		const harness = await linked();
		harness.writes.failures.set("deleteBranch", new Error("socket hang up"));

		await expect(merge(harness).execute(new MergePullRequestCommand(userActor(), { params: PULL_REQUEST, merge: MERGE }))).rejects.toThrow("socket hang up");
	});

	it("refuses when GitHub refuses the merge, and keeps the cached views", async () => {
		const harness = await linked();
		harness.writes.failures.set("merge", new GithubWriteRejectedError("unprocessable", "Head branch was modified", "octo-org/hello-world", "Contents"));

		await expect(merge(harness).execute(new MergePullRequestCommand(userActor(), { params: PULL_REQUEST, merge: MERGE }))).rejects.toBeInstanceOf(GithubWriteRejectedError);
		expect(harness.cache.pullRequests).toEqual([]);
	});
});

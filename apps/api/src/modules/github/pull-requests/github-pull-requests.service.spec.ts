import { Test } from "@nestjs/testing";
import {
	API_VERSION_PREFIX,
	GithubPullRequestFilterSchema,
	type GithubPullRequestFilter,
	type GithubReactionSubject,
	type MergeGithubPullRequestInput,
} from "@workspace/shared";
import { describe, expect, it, vi, type Mock } from "vitest";

import { GITHUB_CLOCK } from "../github-contributions.service";
import { TypedConfigService } from "../../../config/typed-config.service";
import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { GithubCommentPicturesService } from "./github-comment-pictures.service";
import { GithubPictureAddresses } from "./github-picture-addresses";
import { GithubCredentialsService, type LinkedGithubCredential } from "./github-credentials.service";
import { GithubPullRequestCache } from "./github-pull-request.cache";
import { GithubPullRequestClient } from "./github-pull-request.client";
import { buildPullRequestSearch, filterQualifier, GithubPullRequestsService } from "./github-pull-requests.service";
import { commitDetailWire } from "../__tests__/github-wire.builders";
import { GithubWriteRejectedError } from "../github.errors";
import { detailWire, HEAD_SHA, mergeStateWire, PULL_REQUEST, summaryWire } from "./__tests__/github-pull-request-wire.builders";

const LINKED: LinkedGithubCredential = { credential: { source: "linked", token: "github_pat_linked" }, login: "octocat" };

interface FakeClient {
	readonly searchPullRequests: Mock<GithubPullRequestClient["searchPullRequests"]>;
	readonly fetchPullRequest: Mock<GithubPullRequestClient["fetchPullRequest"]>;
	readonly fetchFiles: Mock<GithubPullRequestClient["fetchFiles"]>;
	readonly fetchHeadSha: Mock<GithubPullRequestClient["fetchHeadSha"]>;
	readonly fetchCommit: Mock<GithubPullRequestClient["fetchCommit"]>;
	readonly addComment: Mock<GithubPullRequestClient["addComment"]>;
	readonly submitReview: Mock<GithubPullRequestClient["submitReview"]>;
	readonly setReaction: Mock<GithubPullRequestClient["setReaction"]>;
	readonly fetchChecks: Mock<GithubPullRequestClient["fetchChecks"]>;
	readonly fetchMergeState: Mock<GithubPullRequestClient["fetchMergeState"]>;
	readonly merge: Mock<GithubPullRequestClient["merge"]>;
	readonly deleteBranch: Mock<GithubPullRequestClient["deleteBranch"]>;
}

interface Harness {
	readonly service: GithubPullRequestsService;
	readonly client: FakeClient;
	readonly cache: GithubPullRequestCache;
	readonly withCredential: Mock<GithubCredentialsService["withCredential"]>;
	readonly commitLinkedPictures: Mock<GithubCommentPicturesService["commitLinkedPictures"]>;
}

async function setup(): Promise<Harness> {
	const client: FakeClient = {
		searchPullRequests: vi.fn<GithubPullRequestClient["searchPullRequests"]>(() =>
			Promise.resolve({ issueCount: 1, pageInfo: { hasNextPage: false, endCursor: null }, nodes: [{ ...summaryWire(), __typename: "PullRequest" }] }),
		),
		fetchPullRequest: vi.fn<GithubPullRequestClient["fetchPullRequest"]>(() => Promise.resolve(detailWire())),
		fetchFiles: vi.fn<GithubPullRequestClient["fetchFiles"]>(() => Promise.resolve({ files: [], hasNextPage: false })),
		fetchHeadSha: vi.fn<GithubPullRequestClient["fetchHeadSha"]>(() => Promise.resolve(HEAD_SHA)),
		fetchCommit: vi.fn<GithubPullRequestClient["fetchCommit"]>(() => Promise.resolve({ commit: commitDetailWire(), filesTruncated: false })),
		addComment: vi.fn<GithubPullRequestClient["addComment"]>(() =>
			Promise.resolve({
				id: 6186769145,
				node_id: "IC_new",
				user: null,
				body: "Thanks!",
				created_at: "2026-10-15T08:00:00Z",
				html_url: "https://github.com/octo-org/hello-world/pull/42#issuecomment-1",
			}),
		),
		fetchChecks: vi.fn<GithubPullRequestClient["fetchChecks"]>(() =>
			Promise.resolve({ state: "SUCCESS", contexts: { checkRunCountsByState: [{ state: "SUCCESS", count: 3 }], statusContextCountsByState: null } }),
		),
		fetchMergeState: vi.fn<GithubPullRequestClient["fetchMergeState"]>(() => Promise.resolve(mergeStateWire())),
		merge: vi.fn<GithubPullRequestClient["merge"]>(() => Promise.resolve("m".repeat(40))),
		deleteBranch: vi.fn<GithubPullRequestClient["deleteBranch"]>(() => Promise.resolve()),
		setReaction: vi.fn<GithubPullRequestClient["setReaction"]>(() => Promise.resolve()),
		submitReview: vi.fn<GithubPullRequestClient["submitReview"]>(() =>
			Promise.resolve({
				node_id: "PRR_new",
				user: null,
				body: null,
				state: "APPROVED",
				submitted_at: null,
				html_url: "https://github.com/octo-org/hello-world/pull/42#pullrequestreview-1",
			}),
		),
	};
	// The real credential gate is GithubCredentialsService's own spec; here it hands out one linked token.
	const withCredential = vi.fn(<T>(_userId: string, use: (linked: LinkedGithubCredential) => Promise<T>): Promise<T> => use(LINKED));
	// Which pictures a body links, and committing them, is GithubCommentPicturesService's own spec.
	const commitLinkedPictures = vi.fn<GithubCommentPicturesService["commitLinkedPictures"]>(() => Promise.resolve());
	const moduleRef = await Test.createTestingModule({
		providers: [
			GithubPullRequestsService,
			GithubPullRequestCache,
			{ provide: GithubPullRequestClient, useValue: client },
			{ provide: GithubCredentialsService, useValue: { withCredential } },
			{ provide: GITHUB_CLOCK, useValue: { nowEpochMs: (): number => 0 } },
			{ provide: TypedConfigService, useValue: createTestTypedConfig({}) },
			GithubPictureAddresses,
			{ provide: GithubCommentPicturesService, useValue: { commitLinkedPictures } },
		],
	}).compile();
	return {
		service: moduleRef.get(GithubPullRequestsService),
		client,
		cache: moduleRef.get(GithubPullRequestCache),
		withCredential,
		commitLinkedPictures,
	};
}

describe("buildPullRequestSearch", () => {
	it.each<[GithubPullRequestFilter, string]>([
		["yours", "user:octocat"],
		["created", "author:@me"],
		["reviewRequested", "review-requested:@me"],
		["assigned", "assignee:@me"],
		["mentioned", "mentions:@me"],
	])("searches %s with %j", (filter: GithubPullRequestFilter, qualifier: string) => {
		expect(filterQualifier(filter, "octocat")).toBe(qualifier);
	});

	it("always asks for pull requests in live repositories, most recently updated first, in the chosen state", () => {
		expect(buildPullRequestSearch("created", "closed", "octocat")).toBe("is:pr archived:false sort:updated-desc is:closed author:@me");
	});

	it("has a qualifier for every filter the contract offers", () => {
		expect(GithubPullRequestFilterSchema.options.every((filter: GithubPullRequestFilter): boolean => filterQualifier(filter, "octocat").length > 0)).toBe(true);
	});
});

describe("GithubPullRequestsService", () => {
	it("lists with the caller's own credential and the search built from the filter", async () => {
		const { service, client, withCredential } = await setup();

		const page = await service.list("user-1", { filter: "yours", state: "open" });

		expect(page.items).toHaveLength(1);
		expect(withCredential).toHaveBeenCalledWith("user-1", expect.any(Function));
		expect(client.searchPullRequests).toHaveBeenCalledWith(LINKED.credential, "is:pr archived:false sort:updated-desc is:open user:octocat", null);
	});

	it("caches each user's answers apart — one user's read never answers another's", async () => {
		const { service, client } = await setup();

		await service.detail("user-1", PULL_REQUEST);
		await service.detail("user-1", PULL_REQUEST);
		await service.detail("user-2", PULL_REQUEST);

		expect(client.fetchPullRequest).toHaveBeenCalledTimes(2);
	});

	it("reads GitHub again once the pull request is invalidated", async () => {
		const { service, client, cache } = await setup();

		await service.detail("user-1", PULL_REQUEST);
		cache.invalidatePullRequest("Octo-Org", "Hello-World", PULL_REQUEST.number);
		await service.detail("user-1", PULL_REQUEST);

		expect(client.fetchPullRequest).toHaveBeenCalledTimes(2);
	});

	it("answers a page of files with the head commit it belongs to", async () => {
		const { service, client } = await setup();

		const page = await service.files("user-1", PULL_REQUEST, 1);

		expect(page).toEqual({ files: [], nextPage: null, headSha: HEAD_SHA });
		expect(client.fetchFiles).toHaveBeenCalledWith(LINKED.credential, PULL_REQUEST, 1);
		expect(client.fetchHeadSha).toHaveBeenCalledWith(LINKED.credential, PULL_REQUEST);
	});

	it("reads a pull request's commit with the caller's token, cached per user like the other views", async () => {
		const { service, client } = await setup();
		const params = { ...PULL_REQUEST, sha: HEAD_SHA };

		const commit = await service.commit("user-1", params);
		await service.commit("user-1", params);

		expect(commit.sha).toBe(commitDetailWire().sha);
		expect(client.fetchCommit).toHaveBeenCalledTimes(1);
		expect(client.fetchCommit).toHaveBeenCalledWith(LINKED.credential, params);
	});

	it("comments as the caller and drops every cached view of the pull request, so the next read shows the comment", async () => {
		const { service, client } = await setup();
		await service.detail("user-1", PULL_REQUEST);

		const comment = await service.addComment("user-1", PULL_REQUEST, { body: "Thanks!" });
		await service.detail("user-1", PULL_REQUEST);

		expect(comment.body).toBe("Thanks!");
		expect(client.addComment).toHaveBeenCalledWith(LINKED.credential, PULL_REQUEST, "Thanks!");
		expect(client.fetchPullRequest).toHaveBeenCalledTimes(2);
	});

	it("submits a review as the caller and drops the cached views", async () => {
		const { service, client } = await setup();
		await service.detail("user-1", PULL_REQUEST);

		const review = await service.submitReview("user-1", PULL_REQUEST, { event: "approve", body: "" });
		await service.detail("user-1", PULL_REQUEST);

		expect(review).toMatchObject({ state: "approved", body: "", submittedAt: null, createdAt: 0, viewerDidAuthor: true });
		expect(client.submitReview).toHaveBeenCalledWith(LINKED.credential, PULL_REQUEST, "approve", "");
		expect(client.fetchPullRequest).toHaveBeenCalledTimes(2);
	});

	it("sets a reaction as the caller's account and drops the cached views", async () => {
		const { service, client } = await setup();
		await service.detail("user-1", PULL_REQUEST);
		const subject: GithubReactionSubject = { type: "issueComment", commentId: "6186769145" };

		const state = await service.setReaction("user-1", PULL_REQUEST, { subject, content: "heart", reacted: true });
		await service.detail("user-1", PULL_REQUEST);

		expect(state).toEqual({ subject, content: "heart", reacted: true });
		expect(client.setReaction).toHaveBeenCalledWith(LINKED.credential, "octocat", PULL_REQUEST, subject, "heart", true);
		expect(client.fetchPullRequest).toHaveBeenCalledTimes(2);
	});

	it("lists a picture GitHub shows only to signed-in readers at the API's own lasting address; other pictures load where GitHub serves them", async () => {
		const { service, client } = await setup();
		const repositoryPicture = "https://github.com/octo-org/hello-world/raw/github-comment-assets/pull-requests/42/a.png";
		const upload = "cb5fe4d3-85fb-4d1e-807a-1771925051be";
		const signed = `https://private-user-images.githubusercontent.com/1/2-${upload}.png?jwt=eyJ0`;
		client.fetchPullRequest.mockResolvedValueOnce(
			detailWire({
				bodyHTML: `<img src="${repositoryPicture}"><img src="${signed}"><img src="https://camo.githubusercontent.com/x" data-canonical-src="https://example.com/b.png">`,
			}),
		);

		const detail = await service.detail("user-1", PULL_REQUEST);
		const [picture, uploaded, outside] = detail.bodyImages;
		const api = `${createTestTypedConfig({}).http.publicUrl}${API_VERSION_PREFIX}`;

		expect(picture).toEqual({
			source: repositoryPicture,
			url: `${api}/github/pictures/file?owner=octo-org&repository=hello-world&ref=github-comment-assets&path=pull-requests%2F42%2Fa.png`,
		});
		expect(uploaded).toEqual({ source: `https://github.com/user-attachments/assets/${upload}`, url: `${api}/github/pictures/uploads/${upload}?node=${detail.id}` });
		expect(outside).toEqual({ source: "https://example.com/b.png", url: "https://camo.githubusercontent.com/x" });
	});

	it("commits the pictures a comment or review links before posting it", async () => {
		const { service, client, commitLinkedPictures } = await setup();

		await service.addComment("user-1", PULL_REQUEST, { body: "![shot](https://example.com/a.png)" });
		await service.submitReview("user-1", PULL_REQUEST, { event: "comment", body: "See above" });

		expect(commitLinkedPictures.mock.calls).toEqual([
			[LINKED.credential, "user-1", PULL_REQUEST, "![shot](https://example.com/a.png)"],
			[LINKED.credential, "user-1", PULL_REQUEST, "See above"],
		]);
		expect(commitLinkedPictures.mock.invocationCallOrder.at(0)).toBeLessThan(client.addComment.mock.invocationCallOrder.at(0) ?? 0);
	});

	it("posts nothing when a linked picture cannot be committed", async () => {
		const { service, client, commitLinkedPictures } = await setup();
		commitLinkedPictures.mockRejectedValueOnce(new Error("picture gone"));

		await expect(service.addComment("user-1", PULL_REQUEST, { body: "Hi" })).rejects.toThrow("picture gone");
		expect(client.addComment).not.toHaveBeenCalled();
	});

	it("keeps the cached views when GitHub refuses the write", async () => {
		const { service, client } = await setup();
		client.addComment.mockRejectedValueOnce(new Error("refused"));
		await service.detail("user-1", PULL_REQUEST);

		await expect(service.addComment("user-1", PULL_REQUEST, { body: "Hi" })).rejects.toThrow("refused");
		await service.detail("user-1", PULL_REQUEST);

		expect(client.fetchPullRequest).toHaveBeenCalledTimes(1);
	});

	it("answers the merge box from the checks and the mergeability, read together and cached per user", async () => {
		const { service, client } = await setup();

		const status = await service.status("user-1", PULL_REQUEST);
		await service.status("user-1", PULL_REQUEST);

		expect(status).toEqual({
			checks: { kind: "summary", state: "success", successful: 3, failed: 0, pending: 0, skipped: 0 },
			mergeability: "mergeable",
			merge: {
				headSha: HEAD_SHA,
				state: "clean",
				methods: ["merge", "squash", "rebase"],
				defaultMethod: "squash",
				headBranch: "feature/pull-requests",
				canDeleteHeadBranch: true,
				deletesBranchOnMerge: false,
			},
		});
		expect(client.fetchChecks).toHaveBeenCalledTimes(1);
		expect(client.fetchMergeState).toHaveBeenCalledTimes(1);
	});

	it("merges as the caller, pinned to the head they saw, then deletes the branch and drops the cached views", async () => {
		const { service, client } = await setup();
		await service.detail("user-1", PULL_REQUEST);

		const result = await service.merge("user-1", PULL_REQUEST, {
			method: "squash",
			expectedHeadSha: HEAD_SHA,
			commitTitle: "Add screens (#42)",
			commitMessage: "",
			deleteBranch: true,
		});
		await service.detail("user-1", PULL_REQUEST);

		expect(result).toEqual({ sha: "m".repeat(40), branch: { outcome: "deleted" } });
		expect(client.merge).toHaveBeenCalledWith(LINKED.credential, PULL_REQUEST, { method: "squash", sha: HEAD_SHA, title: "Add screens (#42)", message: "" });
		expect(client.deleteBranch).toHaveBeenCalledWith(LINKED.credential, PULL_REQUEST, "feature/pull-requests");
		expect(client.fetchPullRequest).toHaveBeenCalledTimes(2);
	});

	it("keeps the branch when not asked to delete it, or when it is a fork's", async () => {
		const { service, client } = await setup();
		const input: Omit<MergeGithubPullRequestInput, "deleteBranch"> = { method: "merge", expectedHeadSha: HEAD_SHA, commitTitle: "", commitMessage: "" };

		await expect(service.merge("user-1", PULL_REQUEST, { ...input, deleteBranch: false })).resolves.toMatchObject({ branch: { outcome: "kept" } });
		client.fetchMergeState.mockResolvedValueOnce(mergeStateWire({ isCrossRepository: true }));
		await expect(service.merge("user-1", PULL_REQUEST, { ...input, deleteBranch: true })).resolves.toMatchObject({ branch: { outcome: "kept" } });
		expect(client.deleteBranch).not.toHaveBeenCalled();
	});

	it("reports a branch GitHub would not delete without undoing the merge", async () => {
		const { service, client } = await setup();
		client.deleteBranch.mockRejectedValueOnce(new GithubWriteRejectedError("unprocessable", "Cannot delete this protected branch", "octo-org/hello-world", "Contents"));

		const result = await service.merge("user-1", PULL_REQUEST, { method: "merge", expectedHeadSha: HEAD_SHA, commitTitle: "", commitMessage: "", deleteBranch: true });

		expect(result).toEqual({ sha: "m".repeat(40), branch: { outcome: "failed", reason: "GitHub refused this: Cannot delete this protected branch" } });
	});
});

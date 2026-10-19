import { Test } from "@nestjs/testing";
import { API_VERSION_PREFIX, type GithubReactionSubject } from "@workspace/shared";
import { describe, expect, it, vi, type Mock } from "vitest";

import { TypedConfigService } from "../../../../../config/typed-config.service";
import { createTestTypedConfig } from "../../../../../../test/support/test-api-env";
import type { LinkedGithubCredential } from "../../../application/ports/github-credentials.port";
import type { GithubMergeRequest } from "../../../application/ports/github-pull-requests.port";
import { GITHUB_CLOCK } from "../../../application/ports/github.tokens";
import { commitDetailWire } from "../../github-api/__tests__/github-wire.builders";
import { detailWire, HEAD_SHA, mergeStateWire, PULL_REQUEST, summaryWire } from "../../github-api/__tests__/github-pull-request-wire.builders";
import type { GithubCredential } from "../../github-api/github-http.transport";
import { GithubPictureAddresses } from "../../github-api/github-picture-addresses";
import { GithubPullRequestCache } from "../../github-api/github-pull-request.cache";
import { GithubPullRequestClient } from "../../github-api/github-pull-request.client";
import { GithubPullRequestReadsAdapter } from "../github-pull-request-reads.adapter";
import { GithubPullRequestWritesAdapter } from "../github-pull-request-writes.adapter";

/** GitHub's HTTP boundary is the client; these specs drive the adapters (cache + mapping) over a scripted one. */
const LINKED: LinkedGithubCredential = { token: "github_pat_linked", login: "octocat" };
const TRANSPORT_CREDENTIAL: GithubCredential = { source: "linked", token: "github_pat_linked" };
/** When the fake clock says a review was submitted. */
const NOW = 1_800_000_000_000;

interface ScriptedClient {
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
	readonly reads: GithubPullRequestReadsAdapter;
	readonly writes: GithubPullRequestWritesAdapter;
	readonly client: ScriptedClient;
	readonly cache: GithubPullRequestCache;
}

function scriptedClient(): ScriptedClient {
	return {
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
}

async function setup(): Promise<Harness> {
	const client = scriptedClient();
	const moduleRef = await Test.createTestingModule({
		providers: [
			GithubPullRequestReadsAdapter,
			GithubPullRequestWritesAdapter,
			GithubPullRequestCache,
			GithubPictureAddresses,
			{ provide: GithubPullRequestClient, useValue: client },
			{ provide: GITHUB_CLOCK, useValue: { nowEpochMs: (): number => NOW } },
			{ provide: TypedConfigService, useValue: createTestTypedConfig({}) },
		],
	}).compile();
	return { reads: moduleRef.get(GithubPullRequestReadsAdapter), writes: moduleRef.get(GithubPullRequestWritesAdapter), client, cache: moduleRef.get(GithubPullRequestCache) };
}

describe("GithubPullRequestReadsAdapter", () => {
	it("lists with the caller's own token and the search built from the filter", async () => {
		const { reads, client } = await setup();

		const page = await reads.list("user-1", LINKED, { filter: "yours", state: "open" });

		expect(page.items).toHaveLength(1);
		expect(client.searchPullRequests).toHaveBeenCalledWith(TRANSPORT_CREDENTIAL, "is:pr archived:false sort:updated-desc is:open user:octocat", null);
	});

	it("caches each user's answers apart — one user's read never answers another's", async () => {
		const { reads, client } = await setup();

		await reads.detail("user-1", LINKED, PULL_REQUEST);
		await reads.detail("user-1", LINKED, PULL_REQUEST);
		await reads.detail("user-2", LINKED, PULL_REQUEST);

		expect(client.fetchPullRequest).toHaveBeenCalledTimes(2);
	});

	it("reads GitHub again once the pull request is invalidated", async () => {
		const { reads, client, cache } = await setup();

		await reads.detail("user-1", LINKED, PULL_REQUEST);
		cache.invalidatePullRequest("Octo-Org", "Hello-World", PULL_REQUEST.number);
		await reads.detail("user-1", LINKED, PULL_REQUEST);

		expect(client.fetchPullRequest).toHaveBeenCalledTimes(2);
	});

	it("answers a page of files with the head commit it belongs to", async () => {
		const { reads, client } = await setup();

		await expect(reads.files("user-1", LINKED, PULL_REQUEST, 1)).resolves.toEqual({ files: [], nextPage: null, headSha: HEAD_SHA });
		expect(client.fetchFiles).toHaveBeenCalledWith(TRANSPORT_CREDENTIAL, PULL_REQUEST, 1);
		expect(client.fetchHeadSha).toHaveBeenCalledWith(TRANSPORT_CREDENTIAL, PULL_REQUEST);
	});

	it("reads a pull request's commit with the caller's token, cached per user like the other views", async () => {
		const { reads, client } = await setup();
		const params = { ...PULL_REQUEST, sha: HEAD_SHA };

		const commit = await reads.commit("user-1", LINKED, params);
		await reads.commit("user-1", LINKED, params);

		expect(commit.sha).toBe(commitDetailWire().sha);
		expect(client.fetchCommit).toHaveBeenCalledTimes(1);
		expect(client.fetchCommit).toHaveBeenCalledWith(TRANSPORT_CREDENTIAL, params);
	});

	it("lists a picture GitHub shows only to signed-in readers at the API's own lasting address; other pictures load where GitHub serves them", async () => {
		const { reads, client } = await setup();
		const repositoryPicture = "https://github.com/octo-org/hello-world/raw/github-comment-assets/pull-requests/42/a.png";
		const upload = "cb5fe4d3-85fb-4d1e-807a-1771925051be";
		const signed = `https://private-user-images.githubusercontent.com/1/2-${upload}.png?jwt=eyJ0`;
		client.fetchPullRequest.mockResolvedValueOnce(
			detailWire({
				bodyHTML: `<img src="${repositoryPicture}"><img src="${signed}"><img src="https://camo.githubusercontent.com/x" data-canonical-src="https://example.com/b.png">`,
			}),
		);

		const detail = await reads.detail("user-1", LINKED, PULL_REQUEST);
		const [picture, uploaded, outside] = detail.bodyImages;
		const api = `${createTestTypedConfig({}).http.publicUrl}${API_VERSION_PREFIX}`;

		expect(picture).toEqual({
			source: repositoryPicture,
			url: `${api}/github/pictures/file?owner=octo-org&repository=hello-world&ref=github-comment-assets&path=pull-requests%2F42%2Fa.png`,
		});
		expect(uploaded).toEqual({ source: `https://github.com/user-attachments/assets/${upload}`, url: `${api}/github/pictures/uploads/${upload}?node=${detail.id}` });
		expect(outside).toEqual({ source: "https://example.com/b.png", url: "https://camo.githubusercontent.com/x" });
	});

	it("answers the merge box from the checks and the mergeability, read together and cached per user", async () => {
		const { reads, client } = await setup();

		const status = await reads.status("user-1", LINKED, PULL_REQUEST);
		await reads.status("user-1", LINKED, PULL_REQUEST);

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
});

describe("GithubPullRequestWritesAdapter", () => {
	it("comments as the caller and answers the comment in our contract", async () => {
		const { writes, client } = await setup();

		await expect(writes.addComment(LINKED, PULL_REQUEST, "Thanks!")).resolves.toMatchObject({ id: "IC_new", body: "Thanks!" });
		expect(client.addComment).toHaveBeenCalledWith(TRANSPORT_CREDENTIAL, PULL_REQUEST, "Thanks!");
	});

	it("submits a review as the caller, dated now when GitHub gives no time", async () => {
		const { writes, client } = await setup();

		await expect(writes.submitReview(LINKED, PULL_REQUEST, "approve", "")).resolves.toMatchObject({
			state: "approved",
			body: "",
			submittedAt: null,
			createdAt: NOW,
			viewerDidAuthor: true,
		});
		expect(client.submitReview).toHaveBeenCalledWith(TRANSPORT_CREDENTIAL, PULL_REQUEST, "approve", "");
	});

	it("sets a reaction as the caller's account, by its login", async () => {
		const { writes, client } = await setup();
		const subject: GithubReactionSubject = { type: "issueComment", commentId: "6186769145" };

		await writes.setReaction(LINKED, PULL_REQUEST, subject, "heart", true);

		expect(client.setReaction).toHaveBeenCalledWith(TRANSPORT_CREDENTIAL, "octocat", PULL_REQUEST, subject, "heart", true);
	});

	it("merges pinned to the head the caller saw, and reads the head branch from the merge state", async () => {
		const { writes, client } = await setup();
		const request: GithubMergeRequest = { method: "squash", sha: HEAD_SHA, title: "Add screens (#42)", message: "" };

		await expect(writes.merge(LINKED, PULL_REQUEST, request)).resolves.toBe("m".repeat(40));
		await expect(writes.headBranch(LINKED, PULL_REQUEST)).resolves.toEqual({ isCrossRepository: false, headRefName: "feature/pull-requests" });
		await writes.deleteBranch(LINKED, PULL_REQUEST, "feature/pull-requests");

		expect(client.merge).toHaveBeenCalledWith(TRANSPORT_CREDENTIAL, PULL_REQUEST, request);
		expect(client.deleteBranch).toHaveBeenCalledWith(TRANSPORT_CREDENTIAL, PULL_REQUEST, "feature/pull-requests");
	});
});

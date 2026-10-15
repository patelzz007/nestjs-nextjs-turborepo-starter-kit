import { Logger } from "@nestjs/common";
import { GITHUB_COMMIT_FILES_MAX, GITHUB_PULL_REQUEST_FILE_PAGE_SIZE, GITHUB_PULL_REQUEST_PAGE_SIZE, type GithubMergeMethod, type GithubReviewEvent } from "@workspace/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { commitDetailWire } from "../__tests__/github-wire.builders";
import { GithubCommitNotFoundError, GithubContentNotFoundError, GithubPullRequestNotFoundError, GithubUnavailableError, GithubWriteRejectedError } from "../github.errors";
import { GithubHttpTransport, type GithubCredential, type GithubFetch } from "../github-http.transport";
import { GITHUB_TOKEN_EXPIRATION_HEADER, GithubPullRequestClient, parseTokenExpiration } from "./github-pull-request.client";
import { GITHUB_PULL_REQUEST_SEARCH_QUERY } from "./github-pull-requests.queries";
import { detailWire, HEAD_SHA, mergeStateWire, PULL_REQUEST, summaryWire } from "./__tests__/github-pull-request-wire.builders";

const LINKED: GithubCredential = { source: "linked", token: "github_pat_linked" };

/** What a GraphQL request carried. */
const GraphqlBodySchema = z.object({ query: z.string(), variables: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])) });

function json(body: object, status = 200, headers: Record<string, string> = {}): Response {
	return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

function client(fetchGithub: GithubFetch): GithubPullRequestClient {
	const config = createTestTypedConfig({});
	return new GithubPullRequestClient(new GithubHttpTransport(config, fetchGithub));
}

/** What a REST write carried. */
const RestBodySchema = z.record(z.string(), z.string());

/** The method, URL and JSON body of the only request sent. */
function onlyWrite(fetchGithub: ReturnType<typeof vi.fn<GithubFetch>>): {
	readonly method: string | undefined;
	readonly url: string;
	readonly body: z.output<typeof RestBodySchema>;
} {
	expect(fetchGithub).toHaveBeenCalledTimes(1);
	const [[url, init] = ["", {}]] = fetchGithub.mock.calls;
	return { method: init.method, url, body: RestBodySchema.parse(JSON.parse(z.string().parse(init.body))) };
}

const POSTED_COMMENT = {
	id: 6186769145,
	node_id: "IC_new",
	user: { login: "octocat", avatar_url: "https://avatars.githubusercontent.com/u/583231" },
	body: "Thanks!",
	created_at: "2026-10-15T08:00:00Z",
	html_url: "https://github.com/octo-org/hello-world/pull/42#issuecomment-1",
};

function submittedReview(state: string): object {
	return { ...POSTED_COMMENT, node_id: "PRR_new", body: "", state, submitted_at: "2026-10-15T08:00:00Z" };
}

/** The URL and parsed body of the only request sent. */
function onlyRequest(fetchGithub: ReturnType<typeof vi.fn<GithubFetch>>): { readonly url: string; readonly body: z.output<typeof GraphqlBodySchema> | null } {
	expect(fetchGithub).toHaveBeenCalledTimes(1);
	const [[url, init] = ["", {}]] = fetchGithub.mock.calls;
	const parsed = GraphqlBodySchema.safeParse(init.body === undefined || init.body === null ? null : JSON.parse(z.string().parse(init.body)));
	return { url, body: parsed.success ? parsed.data : null };
}

describe("parseTokenExpiration", () => {
	it.each([
		["2026-11-14 00:00:00 UTC", Date.parse("2026-11-14T00:00:00Z")],
		["2026-11-14 08:00:00 +0800", Date.parse("2026-11-14T00:00:00Z")],
		["2026-11-13 19:00:00 -0500", Date.parse("2026-11-14T00:00:00Z")],
	])("reads %j", (header: string, expected: number) => {
		expect(parseTokenExpiration(header)).toBe(expected);
	});

	it.each([null, "", "next Tuesday", "2026-11-14T00:00:00Z"])("treats %j as no known expiry", (header: string | null) => {
		expect(parseTokenExpiration(header)).toBeNull();
	});
});

describe("GithubPullRequestClient", () => {
	beforeEach(() => {
		vi.spyOn(Logger.prototype, "warn").mockImplementation((): void => undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("asks GitHub who a token belongs to and when it expires", async () => {
		const fetchGithub = vi.fn<GithubFetch>(() =>
			Promise.resolve(
				json({ id: 583231, login: "octocat", avatar_url: "https://avatars.githubusercontent.com/u/583231" }, 200, {
					[GITHUB_TOKEN_EXPIRATION_HEADER]: "2026-11-14 00:00:00 UTC",
				}),
			),
		);

		const owner = await client(fetchGithub).fetchTokenOwner(LINKED);

		expect(owner).toEqual({
			user: { id: 583231, login: "octocat", avatar_url: "https://avatars.githubusercontent.com/u/583231" },
			tokenExpiresAt: Date.parse("2026-11-14T00:00:00Z"),
		});
		expect(onlyRequest(fetchGithub).url).toBe("https://api.github.com/user");
	});

	it("searches with the query it is given, a page at a time", async () => {
		const fetchGithub = vi.fn<GithubFetch>(() =>
			Promise.resolve(
				json({ data: { search: { issueCount: 1, pageInfo: { hasNextPage: false, endCursor: null }, nodes: [{ ...summaryWire(), __typename: "PullRequest" }] } } }),
			),
		);

		const search = await client(fetchGithub).searchPullRequests(LINKED, "is:pr is:open author:@me", "cursor-1");

		expect(search.issueCount).toBe(1);
		expect(onlyRequest(fetchGithub).body).toEqual({
			query: GITHUB_PULL_REQUEST_SEARCH_QUERY,
			variables: { query: "is:pr is:open author:@me", first: GITHUB_PULL_REQUEST_PAGE_SIZE, after: "cursor-1" },
		});
	});

	it("reads one pull request, and answers 404 when GitHub shows the token none", async () => {
		const found = vi.fn<GithubFetch>(() => Promise.resolve(json({ data: { repository: { pullRequest: detailWire() } } })));
		const missing = vi.fn<GithubFetch>(() => Promise.resolve(json({ data: { repository: { pullRequest: null } } })));

		expect((await client(found).fetchPullRequest(LINKED, PULL_REQUEST)).number).toBe(42);
		expect(onlyRequest(found).body?.variables).toMatchObject({ owner: "octo-org", name: "hello-world", number: 42, after: null });
		await expect(client(missing).fetchPullRequest(LINKED, PULL_REQUEST)).rejects.toBeInstanceOf(GithubPullRequestNotFoundError);
	});

	it("reads a page of files and tells from the Link header whether there is another", async () => {
		const files = [{ filename: "src/app.ts", status: "modified", additions: 1, deletions: 0, patch: "@@ -1 +1 @@\n-a\n+b" }];
		const fetchGithub = vi.fn<GithubFetch>(() => Promise.resolve(json(files, 200, { link: '<https://api.github.com/x?page=3>; rel="next"' })));

		const page = await client(fetchGithub).fetchFiles(LINKED, PULL_REQUEST, 2);

		expect(page.hasNextPage).toBe(true);
		expect(page.files).toHaveLength(1);
		expect(onlyRequest(fetchGithub).url).toBe(
			`https://api.github.com/repos/octo-org/hello-world/pulls/42/files?per_page=${String(GITHUB_PULL_REQUEST_FILE_PAGE_SIZE)}&page=2`,
		);
	});

	it("reads a comment's edit history, and answers 404 for a node that has none", async () => {
		const edits = { totalCount: 1, nodes: [{ editedAt: "2026-10-02T09:30:00Z", deletedAt: null, diff: "v2", editor: null }] };
		const editable = vi.fn<GithubFetch>(() => Promise.resolve(json({ data: { node: { __typename: "IssueComment", userContentEdits: edits } } })));
		const notEditable = vi.fn<GithubFetch>(() => Promise.resolve(json({ data: { node: { __typename: "Repository" } } })));

		expect(await client(editable).fetchContentEdits(LINKED, "IC_abc")).toEqual(edits);
		await expect(client(notEditable).fetchContentEdits(LINKED, "R_abc")).rejects.toBeInstanceOf(GithubContentNotFoundError);
	});

	it("reads one of the pull request's commits with its diff, and tells when it has more files than read", async () => {
		const fetchGithub = vi.fn<GithubFetch>(() => Promise.resolve(json(commitDetailWire(), 200, { link: '<https://api.github.com/x?page=2>; rel="next"' })));

		const result = await client(fetchGithub).fetchCommit(LINKED, { ...PULL_REQUEST, sha: HEAD_SHA });

		expect(result.filesTruncated).toBe(true);
		expect(onlyRequest(fetchGithub).url).toBe(`https://api.github.com/repos/octo-org/hello-world/commits/${HEAD_SHA}?per_page=${String(GITHUB_COMMIT_FILES_MAX)}`);
	});

	it("answers 404 for a commit GitHub does not know (it answers 422)", async () => {
		const fetchGithub = vi.fn<GithubFetch>(() => Promise.resolve(json({ message: "No commit found for SHA" }, 422)));

		await expect(client(fetchGithub).fetchCommit(LINKED, { ...PULL_REQUEST, sha: HEAD_SHA })).rejects.toBeInstanceOf(GithubCommitNotFoundError);
	});

	it("comments on the conversation through REST, which takes a token with Pull requests: Read and write", async () => {
		const fetchGithub = vi.fn<GithubFetch>(() => Promise.resolve(json(POSTED_COMMENT, 201)));

		const comment = await client(fetchGithub).addComment(LINKED, PULL_REQUEST, "Thanks!");

		expect(comment.node_id).toBe("IC_new");
		expect(onlyWrite(fetchGithub)).toEqual({ method: "POST", url: "https://api.github.com/repos/octo-org/hello-world/issues/42/comments", body: { body: "Thanks!" } });
	});

	it.each<[GithubReviewEvent, string, string, Record<string, string>]>([
		["approve", "APPROVE", "", { event: "APPROVE" }],
		["requestChanges", "REQUEST_CHANGES", "Please add a test.", { event: "REQUEST_CHANGES", body: "Please add a test." }],
		["comment", "COMMENT", "A question.", { event: "COMMENT", body: "A question." }],
	])("submits a %s review as GitHub's %s, leaving out an empty summary", async (event, _githubEvent, body, sent) => {
		const fetchGithub = vi.fn<GithubFetch>(() => Promise.resolve(json(submittedReview("APPROVED"), 200)));

		await client(fetchGithub).submitReview(LINKED, PULL_REQUEST, event, body);

		expect(onlyWrite(fetchGithub)).toEqual({ method: "POST", url: "https://api.github.com/repos/octo-org/hello-world/pulls/42/reviews", body: sent });
	});

	it.each<[string, Parameters<GithubPullRequestClient["setReaction"]>[3], string]>([
		["the pull request", { type: "pullRequest" }, "issues/42"],
		["a conversation comment", { type: "issueComment", commentId: "6186769145" }, "issues/comments/6186769145"],
		["a line comment", { type: "reviewComment", commentId: "6186769146" }, "pulls/comments/6186769146"],
	])("reacts to %s through REST, in GitHub's reaction names", async (_name, subject, path) => {
		const fetchGithub = vi.fn<GithubFetch>(() =>
			Promise.resolve(json({ id: 9, content: "+1", user: { login: "octocat", avatar_url: "https://avatars.githubusercontent.com/u/1" } }, 201)),
		);

		await client(fetchGithub).setReaction(LINKED, "octocat", PULL_REQUEST, subject, "thumbsUp", true);

		expect(onlyWrite(fetchGithub)).toEqual({ method: "POST", url: `https://api.github.com/repos/octo-org/hello-world/${path}/reactions`, body: { content: "+1" } });
	});

	it("takes a reaction away by finding the account's own one, page by page, and deleting it", async () => {
		const others = { id: 1, content: "heart", user: { login: "hubot", avatar_url: "https://avatars.githubusercontent.com/u/2" } };
		const own = { id: 7, content: "heart", user: { login: "OctoCat", avatar_url: "https://avatars.githubusercontent.com/u/1" } };
		const fetchGithub = vi
			.fn<GithubFetch>()
			.mockResolvedValueOnce(json([others], 200, { link: '<https://api.github.com/x?page=2>; rel="next"' }))
			.mockResolvedValueOnce(json([own]))
			.mockResolvedValueOnce(new Response(null, { status: 204 }));

		await client(fetchGithub).setReaction(LINKED, "octocat", PULL_REQUEST, { type: "issueComment", commentId: "6186769145" }, "heart", false);

		const calls = fetchGithub.mock.calls.map(([url, init]) => `${init.method ?? "GET"} ${url}`);
		expect(calls).toEqual([
			"GET https://api.github.com/repos/octo-org/hello-world/issues/comments/6186769145/reactions?content=heart&per_page=100&page=1",
			"GET https://api.github.com/repos/octo-org/hello-world/issues/comments/6186769145/reactions?content=heart&per_page=100&page=2",
			"DELETE https://api.github.com/repos/octo-org/hello-world/issues/comments/6186769145/reactions/7",
		]);
	});

	it("deletes nothing when the account has no such reaction — it is already off", async () => {
		const fetchGithub = vi.fn<GithubFetch>(() => Promise.resolve(json([])));

		await client(fetchGithub).setReaction(LINKED, "octocat", PULL_REQUEST, { type: "pullRequest" }, "eyes", false);

		expect(fetchGithub).toHaveBeenCalledTimes(1);
	});

	it("says which permission is missing when GitHub forbids the token to react", async () => {
		const fetchGithub = vi.fn<GithubFetch>(() => Promise.resolve(json({ message: "Resource not accessible by personal access token" }, 403)));

		await expect(client(fetchGithub).setReaction(LINKED, "octocat", PULL_REQUEST, { type: "pullRequest" }, "rocket", true)).rejects.toBeInstanceOf(GithubWriteRejectedError);
	});

	it("says which permission is missing when GitHub forbids the token to write", async () => {
		const fetchGithub = vi.fn<GithubFetch>(() => Promise.resolve(json({ message: "Resource not accessible by personal access token" }, 403)));

		const refused = client(fetchGithub).addComment(LINKED, PULL_REQUEST, "Hi");

		await expect(refused).rejects.toBeInstanceOf(GithubWriteRejectedError);
		await expect(refused).rejects.toThrow(
			`Your GitHub token can't write to octo-org/hello-world. Give it "Pull requests: Read and write" access to that repository on GitHub, then try again.`,
		);
	});

	it("passes GitHub's own reason on when its rules refuse a review", async () => {
		const fetchGithub = vi.fn<GithubFetch>(() => Promise.resolve(json({ message: "Unprocessable Entity", errors: ["Can not approve your own pull request"] }, 422)));

		await expect(client(fetchGithub).submitReview(LINKED, PULL_REQUEST, "approve", "")).rejects.toThrow("GitHub refused this: Can not approve your own pull request");
	});

	it("treats a rate-limited write as GitHub being unavailable, not as a refusal", async () => {
		const fetchGithub = vi.fn<GithubFetch>(() => Promise.resolve(json({ message: "API rate limit exceeded" }, 403, { "x-ratelimit-remaining": "0" })));

		await expect(client(fetchGithub).addComment(LINKED, PULL_REQUEST, "Hi")).rejects.toBeInstanceOf(GithubUnavailableError);
	});

	it("answers 404 when the pull request to write to is not visible to the token", async () => {
		const fetchGithub = vi.fn<GithubFetch>(() => Promise.resolve(json({ message: "Not Found" }, 404)));

		await expect(client(fetchGithub).addComment(LINKED, PULL_REQUEST, "Hi")).rejects.toBeInstanceOf(GithubPullRequestNotFoundError);
	});

	it("reads the head commit's check rollup, and none for a commit without checks", async () => {
		const rollup = { state: "SUCCESS", contexts: { checkRunCountsByState: [{ state: "SUCCESS", count: 2 }], statusContextCountsByState: [] } };
		const withChecks = vi.fn<GithubFetch>(() =>
			Promise.resolve(json({ data: { repository: { pullRequest: { commits: { nodes: [{ commit: { statusCheckRollup: rollup } }] } } } } })),
		);
		const withoutChecks = vi.fn<GithubFetch>(() =>
			Promise.resolve(json({ data: { repository: { pullRequest: { commits: { nodes: [{ commit: { statusCheckRollup: null } }] } } } } })),
		);

		expect(await client(withChecks).fetchChecks(LINKED, PULL_REQUEST)).toEqual(rollup);
		expect(await client(withoutChecks).fetchChecks(LINKED, PULL_REQUEST)).toBeNull();
	});

	it("answers the checks as unavailable when GitHub will not show them to the token, instead of failing the merge box", async () => {
		const fetchGithub = vi.fn<GithubFetch>(() =>
			Promise.resolve(json({ data: null, errors: [{ type: "FORBIDDEN", message: "Resource not accessible by personal access token" }] })),
		);

		expect(await client(fetchGithub).fetchChecks(LINKED, PULL_REQUEST)).toBeUndefined();
	});

	it("reads the merge state: mergeable, GitHub's verdict, the head commit and the repository's merge settings", async () => {
		const { pullRequest, ...repository } = mergeStateWire({ mergeable: "CONFLICTING", mergeStateStatus: "DIRTY" });
		const fetchGithub = vi.fn<GithubFetch>(() => Promise.resolve(json({ data: { repository: { ...repository, pullRequest } } })));

		expect(await client(fetchGithub).fetchMergeState(LINKED, PULL_REQUEST)).toEqual(mergeStateWire({ mergeable: "CONFLICTING", mergeStateStatus: "DIRTY" }));
	});

	it.each<[GithubMergeMethod, Record<string, string>]>([
		["squash", { merge_method: "squash", sha: HEAD_SHA, commit_title: "Add screens (#42)", commit_message: "Details" }],
		["rebase", { merge_method: "rebase", sha: HEAD_SHA }],
	])("merges with %s, pinned to the head commit (a rebase takes no title or message)", async (method, sent) => {
		const fetchGithub = vi.fn<GithubFetch>(() => Promise.resolve(json({ sha: "m".repeat(40), merged: true, message: "Pull Request successfully merged" })));

		await expect(client(fetchGithub).merge(LINKED, PULL_REQUEST, { method, sha: HEAD_SHA, title: "Add screens (#42)", message: "Details" })).resolves.toBe("m".repeat(40));
		expect(onlyWrite(fetchGithub)).toEqual({ method: "PUT", url: "https://api.github.com/repos/octo-org/hello-world/pulls/42/merge", body: sent });
	});

	it.each([
		[405, "Pull Request is not mergeable"],
		[409, "Head branch was modified. Review and try the merge again."],
	])("passes GitHub's reason on when it refuses a merge (%i)", async (status, reason) => {
		const fetchGithub = vi.fn<GithubFetch>(() => Promise.resolve(json({ message: reason }, status)));

		await expect(client(fetchGithub).merge(LINKED, PULL_REQUEST, { method: "merge", sha: HEAD_SHA, title: "", message: "" })).rejects.toThrow(
			`GitHub refused this: ${reason}`,
		);
	});

	it("deletes the branch, and takes one the repository already deleted as done", async () => {
		const deleted = vi.fn<GithubFetch>(() => Promise.resolve(new Response(null, { status: 204 })));
		const alreadyGone = vi.fn<GithubFetch>(() => Promise.resolve(json({ message: "Reference does not exist" }, 422)));
		const protectedBranch = vi.fn<GithubFetch>(() => Promise.resolve(json({ message: "Cannot delete this protected branch" }, 422)));

		await client(deleted).deleteBranch(LINKED, PULL_REQUEST, "feature/pull-requests");
		await expect(client(alreadyGone).deleteBranch(LINKED, PULL_REQUEST, "feature/pull-requests")).resolves.toBeUndefined();
		await expect(client(protectedBranch).deleteBranch(LINKED, PULL_REQUEST, "feature/pull-requests")).rejects.toBeInstanceOf(GithubWriteRejectedError);
		expect(deleted.mock.calls.map(([url, init]) => `${init.method ?? "GET"} ${url}`)).toEqual([
			"DELETE https://api.github.com/repos/octo-org/hello-world/git/refs/heads/feature/pull-requests",
		]);
	});
});

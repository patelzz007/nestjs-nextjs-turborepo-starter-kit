import { Logger } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { createTestTypedConfig } from "../../../test/support/test-api-env";
import { GITHUB_GRAPHQL_API_URL, GITHUB_REST_API_URL, GITHUB_REST_API_VERSION } from "./github.constants";
import { GithubCommitNotFoundError, GithubRepositoryNotFoundError, GithubResponseError, GithubUnavailableError } from "./github.errors";
import { GITHUB_COMMIT_HISTORY_QUERY, GITHUB_CONTRIBUTION_HISTORY_QUERY, GITHUB_REPOSITORY_SUMMARY_QUERY, GITHUB_VIEWER_REPOSITORIES_QUERY } from "./github.queries";
import { GithubApiClient } from "./github-api.client";
import { GithubHttpTransport, type GithubFetch } from "./github-http.transport";
import {
	SHA_A,
	commitDetailWire,
	commitHistory,
	contributionCommit,
	contributionHistory,
	contributorStat,
	repositoryNode,
	summaryNode,
	viewerRepositories,
} from "./__tests__/github-wire.builders";

const TOKEN = "github_pat_test_read_only";
const TIMEOUT_MS = 1_234;
const REPOSITORY = { owner: "octo-org", repository: "hello-world" };
const CONTRIBUTORS_URL = `${GITHUB_REST_API_URL}/repos/octo-org/hello-world/stats/contributors`;
const COMMIT = { ...REPOSITORY, sha: SHA_A };
const COMMIT_URL = `${GITHUB_REST_API_URL}/repos/octo-org/hello-world/commits/${SHA_A}?per_page=100`;

function json(body: object, status = 200, headers: Record<string, string> = {}): Response {
	return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

/** `token: null` = no `GITHUB_TOKEN` (and so no repositories either). */
function client(fetchGithub: GithubFetch, token: string | null = TOKEN): GithubApiClient {
	const config = createTestTypedConfig({
		...(token === null ? {} : { GITHUB_TOKEN: token, GITHUB_REPOSITORIES: "octo-org/hello-world" }),
		GITHUB_REQUEST_TIMEOUT_MS: String(TIMEOUT_MS),
	});
	return new GithubApiClient(config, new GithubHttpTransport(config, fetchGithub));
}

/** The init of the only request the fake received. */
function onlyInit(fetchGithub: ReturnType<typeof vi.fn<GithubFetch>>): RequestInit {
	expect(fetchGithub).toHaveBeenCalledTimes(1);
	const [call] = fetchGithub.mock.calls;
	if (call === undefined) {
		throw new Error("no request was sent");
	}
	const [, init] = call;
	return init;
}

describe("GithubApiClient", () => {
	beforeEach(() => {
		vi.spyOn(Logger.prototype, "warn").mockImplementation((): void => undefined);
		vi.spyOn(Logger.prototype, "error").mockImplementation((): void => undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("every request", () => {
		it("sends the token, GitHub's media type and API version, the app's user agent and a timeout signal", async () => {
			const fetchGithub = vi.fn<GithubFetch>(() => Promise.resolve(json({ data: { repository: summaryNode() } })));

			await client(fetchGithub).fetchRepositorySummary(REPOSITORY);

			const init = onlyInit(fetchGithub);
			expect(init.headers).toMatchObject({
				Authorization: `Bearer ${TOKEN}`,
				Accept: "application/vnd.github+json",
				"X-GitHub-Api-Version": GITHUB_REST_API_VERSION,
				"User-Agent": createTestTypedConfig().runtime.appName,
			});
			expect(init.signal).toBeInstanceOf(AbortSignal);
		});

		it("reports a timeout as 503 timeout", async () => {
			const timeout = new DOMException("The operation timed out.", "TimeoutError");
			const fetchGithub = vi.fn<GithubFetch>(() => Promise.reject(timeout));

			await expect(client(fetchGithub).fetchRepositorySummary(REPOSITORY)).rejects.toMatchObject({ reason: "timeout", httpStatus: 503, cause: timeout });
		});

		it("reports a network failure as 503 unreachable", async () => {
			const fetchGithub = vi.fn<GithubFetch>(() => Promise.reject(new TypeError("fetch failed")));

			await expect(client(fetchGithub).fetchRepositorySummary(REPOSITORY)).rejects.toMatchObject({ reason: "unreachable", httpStatus: 503 });
		});

		it.each([
			["429", 429, {}],
			["403 with no requests remaining", 403, { "x-ratelimit-remaining": "0" }],
			["403 with Retry-After (secondary limit)", 403, { "retry-after": "60" }],
		])("reports %s as 503 rate-limited", async (_label: string, status: number, headers: Record<string, string>) => {
			const fetchGithub = vi.fn<GithubFetch>(() => Promise.resolve(json({ message: "API rate limit exceeded" }, status, headers)));

			await expect(client(fetchGithub).fetchRepositorySummary(REPOSITORY)).rejects.toMatchObject({ reason: "rate-limited", httpStatus: 503 });
		});

		it("reports 404 as the repository not found on GitHub", async () => {
			const fetchGithub = vi.fn<GithubFetch>(() => Promise.resolve(json({ message: "Not Found" }, 404)));

			await expect(client(fetchGithub).fetchContributorStats(REPOSITORY)).rejects.toBeInstanceOf(GithubRepositoryNotFoundError);
		});

		it.each([
			["a rejected token (401)", 401, "credentials-rejected"],
			["a 403 that is not a rate limit", 403, "unexpected-status"],
			["a server error", 500, "unexpected-status"],
		])("reports %s as 502", async (_label: string, status: number, problem: string) => {
			const fetchGithub = vi.fn<GithubFetch>(() => Promise.resolve(json({ message: "nope" }, status)));

			await expect(client(fetchGithub).fetchRepositorySummary(REPOSITORY)).rejects.toMatchObject({ problem, httpStatus: 502 });
		});

		it("reports a body that is not JSON as 502", async () => {
			const fetchGithub = vi.fn<GithubFetch>(() => Promise.resolve(new Response("<html>", { status: 200 })));

			await expect(client(fetchGithub).fetchRepositorySummary(REPOSITORY)).rejects.toMatchObject({ problem: "unexpected-body" });
		});

		it("reports a body of the wrong shape as 502", async () => {
			const fetchGithub = vi.fn<GithubFetch>(() => Promise.resolve(json({ data: { repository: { ...summaryNode(), stargazerCount: "many" } } })));

			await expect(client(fetchGithub).fetchRepositorySummary(REPOSITORY)).rejects.toMatchObject({ problem: "unexpected-body" });
		});

		it("never sends a request without a token", async () => {
			const fetchGithub = vi.fn<GithubFetch>();

			await expect(client(fetchGithub, null).fetchRepositorySummary(REPOSITORY)).rejects.toMatchObject({ problem: "credentials-rejected" });
			expect(fetchGithub).not.toHaveBeenCalled();
		});
	});

	describe("fetchRepositorySummary", () => {
		it("POSTs the summary query with the repository as variables and returns the repository node", async () => {
			const fetchGithub = vi.fn<GithubFetch>(() => Promise.resolve(json({ data: { repository: summaryNode() } })));

			expect(await client(fetchGithub).fetchRepositorySummary(REPOSITORY)).toEqual(summaryNode());
			expect(fetchGithub).toHaveBeenCalledWith(GITHUB_GRAPHQL_API_URL, expect.objectContaining({ method: "POST" }));
			expect(JSON.parse(z.string().parse(onlyInit(fetchGithub).body))).toEqual({
				query: GITHUB_REPOSITORY_SUMMARY_QUERY,
				variables: { owner: "octo-org", name: "hello-world", languages: 10 },
			});
		});

		it("reports a GraphQL NOT_FOUND as the repository not found", async () => {
			const fetchGithub = vi.fn<GithubFetch>(() => Promise.resolve(json({ data: { repository: null }, errors: [{ type: "NOT_FOUND", message: "Could not resolve" }] })));

			await expect(client(fetchGithub).fetchRepositorySummary(REPOSITORY)).rejects.toBeInstanceOf(GithubRepositoryNotFoundError);
		});

		it("reports a null repository without errors as not found", async () => {
			const fetchGithub = vi.fn<GithubFetch>(() => Promise.resolve(json({ data: { repository: null } })));

			await expect(client(fetchGithub).fetchRepositorySummary(REPOSITORY)).rejects.toBeInstanceOf(GithubRepositoryNotFoundError);
		});

		it("reports a GraphQL RATE_LIMITED as 503 rate-limited", async () => {
			const fetchGithub = vi.fn<GithubFetch>(() => Promise.resolve(json({ errors: [{ type: "RATE_LIMITED", message: "API rate limit exceeded" }] })));

			await expect(client(fetchGithub).fetchRepositorySummary(REPOSITORY)).rejects.toBeInstanceOf(GithubUnavailableError);
		});

		it("reports any other GraphQL error as 502", async () => {
			const fetchGithub = vi.fn<GithubFetch>(() => Promise.resolve(json({ data: null, errors: [{ message: "Something went wrong" }] })));

			await expect(client(fetchGithub).fetchRepositorySummary(REPOSITORY)).rejects.toBeInstanceOf(GithubResponseError);
		});
	});

	describe("fetchCommitHistory", () => {
		it("asks for the page size after the cursor and returns the default branch's history", async () => {
			const fetchGithub = vi.fn<GithubFetch>(() => Promise.resolve(json({ data: { repository: { defaultBranchRef: { target: { history: commitHistory() } } } } })));

			expect(await client(fetchGithub).fetchCommitHistory(REPOSITORY, { first: 20, after: "cursor-1" })).toEqual(commitHistory());
			expect(JSON.parse(z.string().parse(onlyInit(fetchGithub).body))).toEqual({
				query: GITHUB_COMMIT_HISTORY_QUERY,
				variables: { owner: "octo-org", name: "hello-world", first: 20, after: "cursor-1" },
			});
		});

		it("answers null for an empty repository", async () => {
			const fetchGithub = vi.fn<GithubFetch>(() => Promise.resolve(json({ data: { repository: { defaultBranchRef: null } } })));

			expect(await client(fetchGithub).fetchCommitHistory(REPOSITORY, { first: 20, after: null })).toBeNull();
		});

		it("reports a missing repository as not found", async () => {
			const fetchGithub = vi.fn<GithubFetch>(() => Promise.resolve(json({ data: { repository: null } })));

			await expect(client(fetchGithub).fetchCommitHistory(REPOSITORY, { first: 20, after: null })).rejects.toBeInstanceOf(GithubRepositoryNotFoundError);
		});
	});

	describe("fetchContributionHistory", () => {
		it("asks for the page after the cursor and returns the default branch's history", async () => {
			const history = contributionHistory([contributionCommit("amy", 3, 1), contributionCommit(null, 1, 1, 2)], "cursor-2");
			const fetchGithub = vi.fn<GithubFetch>(() => Promise.resolve(json({ data: { repository: { defaultBranchRef: { target: { history } } } } })));

			expect(await client(fetchGithub).fetchContributionHistory(REPOSITORY, { first: 100, after: "cursor-1" })).toEqual(history);
			expect(JSON.parse(z.string().parse(onlyInit(fetchGithub).body))).toEqual({
				query: GITHUB_CONTRIBUTION_HISTORY_QUERY,
				variables: { owner: "octo-org", name: "hello-world", first: 100, after: "cursor-1" },
			});
		});

		it("answers null for an empty repository", async () => {
			const fetchGithub = vi.fn<GithubFetch>(() => Promise.resolve(json({ data: { repository: { defaultBranchRef: null } } })));

			expect(await client(fetchGithub).fetchContributionHistory(REPOSITORY, { first: 100, after: null })).toBeNull();
		});

		it("reports a missing repository as not found", async () => {
			const fetchGithub = vi.fn<GithubFetch>(() => Promise.resolve(json({ data: { repository: null } })));

			await expect(client(fetchGithub).fetchContributionHistory(REPOSITORY, { first: 100, after: null })).rejects.toBeInstanceOf(GithubRepositoryNotFoundError);
		});
	});

	describe("fetchContributorStats", () => {
		it("GETs the repository's contributor statistics", async () => {
			const stats = [contributorStat("amy", [[10, 2, 1]])];
			const fetchGithub = vi.fn<GithubFetch>(() => Promise.resolve(json(stats)));

			expect(await client(fetchGithub).fetchContributorStats(REPOSITORY)).toEqual({ status: "ready", stats });
			expect(fetchGithub).toHaveBeenCalledWith(CONTRIBUTORS_URL, expect.objectContaining({ method: "GET" }));
		});

		it("answers computing while GitHub prepares the statistics (202)", async () => {
			const fetchGithub = vi.fn<GithubFetch>(() => Promise.resolve(json({}, 202)));

			expect(await client(fetchGithub).fetchContributorStats(REPOSITORY)).toEqual({ status: "computing" });
		});

		it("answers no contributors for an empty repository (204)", async () => {
			const fetchGithub = vi.fn<GithubFetch>(() => Promise.resolve(new Response(null, { status: 204 })));

			expect(await client(fetchGithub).fetchContributorStats(REPOSITORY)).toEqual({ status: "ready", stats: [] });
		});

		it("encodes the repository into the path", async () => {
			const fetchGithub = vi.fn<GithubFetch>(() => Promise.resolve(json([])));

			await client(fetchGithub).fetchContributorStats({ owner: "octo-org", repository: "next.js" });

			expect(fetchGithub).toHaveBeenCalledWith(`${GITHUB_REST_API_URL}/repos/octo-org/next.js/stats/contributors`, expect.anything());
		});
	});

	describe("fetchCommit", () => {
		it("GETs the commit with a full page of its files", async () => {
			const fetchGithub = vi.fn<GithubFetch>(() => Promise.resolve(json(commitDetailWire())));

			expect(await client(fetchGithub).fetchCommit(COMMIT)).toEqual({ commit: commitDetailWire(), filesTruncated: false });
			expect(fetchGithub).toHaveBeenCalledWith(COMMIT_URL, expect.objectContaining({ method: "GET" }));
		});

		it("says the files were cut when GitHub links a next page of them", async () => {
			const link = `<${GITHUB_REST_API_URL}/repositories/1/commits/${SHA_A}?per_page=100&page=2>; rel="next", <${GITHUB_REST_API_URL}/repositories/1/commits/${SHA_A}?per_page=100&page=3>; rel="last"`;
			const fetchGithub = vi.fn<GithubFetch>(() => Promise.resolve(json(commitDetailWire(), 200, { link })));

			expect(await client(fetchGithub).fetchCommit(COMMIT)).toMatchObject({ filesTruncated: true });
		});

		it("does not take a link to the previous page for more files", async () => {
			const link = `<${GITHUB_REST_API_URL}/repositories/1/commits/${SHA_A}?per_page=100&page=1>; rel="prev"`;
			const fetchGithub = vi.fn<GithubFetch>(() => Promise.resolve(json(commitDetailWire(), 200, { link })));

			expect(await client(fetchGithub).fetchCommit(COMMIT)).toMatchObject({ filesTruncated: false });
		});

		it.each([
			["an unknown SHA (422)", 422],
			["a missing commit or repository (404)", 404],
		])("reports %s as the commit not found", async (_label: string, status: number) => {
			const fetchGithub = vi.fn<GithubFetch>(() => Promise.resolve(json({ message: "No commit found for SHA" }, status)));

			await expect(client(fetchGithub).fetchCommit(COMMIT)).rejects.toBeInstanceOf(GithubCommitNotFoundError);
		});

		it("reports a 422 about anything but a commit as 502, not as not found", async () => {
			const fetchGithub = vi.fn<GithubFetch>(() => Promise.resolve(json({ message: "Unprocessable" }, 422)));

			await expect(client(fetchGithub).fetchContributorStats(REPOSITORY)).rejects.toMatchObject({ problem: "unexpected-status", httpStatus: 502 });
		});

		it("reports a commit of the wrong shape as 502", async () => {
			const fetchGithub = vi.fn<GithubFetch>(() => Promise.resolve(json({ ...commitDetailWire(), files: "many" })));

			await expect(client(fetchGithub).fetchCommit(COMMIT)).rejects.toMatchObject({ problem: "unexpected-body", httpStatus: 502 });
		});
	});

	describe("fetchViewerRepositories", () => {
		it("asks for 50 repositories per kind and returns the token's account", async () => {
			const viewer = viewerRepositories([repositoryNode("patelzz007/site", "2026-01-01T00:00:00Z")], [repositoryNode("vercel/next.js", null)]);
			const fetchGithub = vi.fn<GithubFetch>(() => Promise.resolve(json({ data: { viewer } })));

			expect(await client(fetchGithub).fetchViewerRepositories()).toEqual(viewer);
			expect(JSON.parse(z.string().parse(onlyInit(fetchGithub).body))).toEqual({ query: GITHUB_VIEWER_REPOSITORIES_QUERY, variables: { first: 50 } });
		});

		it("reports a 404 for the account as an unexpected answer (502), not a missing repository", async () => {
			const fetchGithub = vi.fn<GithubFetch>(() => Promise.resolve(json({ message: "Not Found" }, 404)));

			await expect(client(fetchGithub).fetchViewerRepositories()).rejects.toMatchObject({ problem: "unexpected-status", httpStatus: 502 });
		});

		it("reports an answer without a viewer as 502", async () => {
			const fetchGithub = vi.fn<GithubFetch>(() => Promise.resolve(json({ data: { viewer: null } })));

			await expect(client(fetchGithub).fetchViewerRepositories()).rejects.toMatchObject({ problem: "unexpected-body" });
		});
	});
});

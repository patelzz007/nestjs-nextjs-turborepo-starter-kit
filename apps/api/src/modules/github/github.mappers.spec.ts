import {
	GITHUB_REPOSITORY_LIST_MAX,
	GithubCommitPageSchema,
	GithubContributorStatsSchema,
	GithubRepositoryListSchema,
	GithubRepositorySummarySchema,
} from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { SHA_A, SHA_B, commitHistory, commitNode, contributorStat, repositoryNode, summaryNode, viewerRepositories } from "./__tests__/github-wire.builders";
import {
	GITHUB_INTEGRATION_OFF,
	UNKNOWN_COMMIT_AUTHOR,
	toCommit,
	toConfiguredRepositoryList,
	toDiscoveredRepositoryList,
	toCommitPage,
	toContributorStats,
	toLanguageShares,
	toRepositoryRef,
	toRepositorySummary,
} from "./github.mappers";

const REPOSITORY = { owner: "octo-org", repository: "hello-world" };

describe("toRepositoryRef", () => {
	it("adds the owner/repository full name", () => {
		expect(toRepositoryRef(REPOSITORY)).toEqual({ owner: "octo-org", repository: "hello-world", fullName: "octo-org/hello-world" });
	});
});

describe("toRepositorySummary", () => {
	it("maps every field and satisfies the response contract", () => {
		const summary = toRepositorySummary(REPOSITORY, summaryNode());

		expect(summary).toEqual({
			owner: "octo-org",
			repository: "hello-world",
			fullName: "octo-org/hello-world",
			description: "A hello world repository",
			htmlUrl: "https://github.com/octo-org/hello-world",
			defaultBranch: "main",
			primaryLanguage: "TypeScript",
			stars: 42,
			forks: 7,
			watchers: 5,
			openIssues: 3,
			totalCommits: 128,
			pushedAt: Date.parse("2026-10-01T12:00:00Z"),
			languages: [
				{ name: "TypeScript", color: "#3178c6", bytes: 750, percent: 75 },
				{ name: "CSS", color: "#663399", bytes: 250, percent: 25 },
			],
		});
		expect(GithubRepositorySummarySchema.safeParse(summary).success).toBe(true);
	});

	it("describes an empty repository: no branch, no commits, no push, no language", () => {
		const summary = toRepositorySummary(REPOSITORY, summaryNode({ defaultBranchRef: null, pushedAt: null, primaryLanguage: null, languages: { edges: [] } }));

		expect(summary).toMatchObject({ defaultBranch: null, totalCommits: 0, pushedAt: null, primaryLanguage: null, languages: [] });
	});

	it("counts no commits when the default branch points at something other than a commit", () => {
		expect(toRepositorySummary(REPOSITORY, summaryNode({ defaultBranchRef: { name: "main", target: {} } })).totalCommits).toBe(0);
	});
});

describe("toLanguageShares", () => {
	it("rounds each share to one decimal place", () => {
		const shares = toLanguageShares([
			{ size: 2, node: { name: "A", color: "#000000" } },
			{ size: 1, node: { name: "B", color: "#ffffff" } },
		]);

		expect(shares.map((share) => share.percent)).toEqual([66.7, 33.3]);
	});

	it("answers 0 % rather than dividing by zero when every language is empty", () => {
		expect(toLanguageShares([{ size: 0, node: { name: "A", color: null } }]).map((share) => share.percent)).toEqual([0]);
	});

	it("keeps GitHub's colour only when it is a #rrggbb hex value", () => {
		const shares = toLanguageShares([
			{ size: 1, node: { name: "A", color: "#abc" } },
			{ size: 1, node: { name: "B", color: null } },
			{ size: 1, node: { name: "C", color: "#A1B2C3" } },
		]);

		expect(shares.map((share) => share.color)).toEqual([null, null, "#A1B2C3"]);
	});
});

describe("toCommitPage", () => {
	it("maps the commits and passes the cursor on while there is a next page", () => {
		const page = toCommitPage(commitHistory());

		expect(page.items.map((commit) => commit.sha)).toEqual([SHA_A, SHA_B]);
		expect(page).toMatchObject({ nextCursor: `${SHA_A} 19`, totalCommits: 128 });
		expect(GithubCommitPageSchema.safeParse(page).success).toBe(true);
	});

	it("ends with a null cursor on the last page", () => {
		expect(toCommitPage(commitHistory({ pageInfo: { hasNextPage: false, endCursor: `${SHA_B} 20` } })).nextCursor).toBeNull();
	});

	it("is an empty last page for an empty repository", () => {
		expect(toCommitPage(null)).toEqual({ items: [], nextCursor: null, totalCommits: 0 });
	});
});

describe("toCommit", () => {
	it("maps lines, files, author and time", () => {
		expect(toCommit(commitNode())).toEqual({
			sha: SHA_A,
			shortSha: "aaaaaaa",
			headline: "feat: add contributions",
			htmlUrl: `https://github.com/octo-org/hello-world/commit/${SHA_A}`,
			committedAt: Date.parse("2026-10-02T08:30:00Z"),
			author: { name: "Octo Cat", login: "octocat", avatarUrl: "https://avatars.githubusercontent.com/u/1" },
			additions: 120,
			deletions: 30,
			changedFiles: 4,
		});
	});

	it("keeps the git name of an author with no GitHub account", () => {
		expect(toCommit(commitNode({ author: { name: "Local Dev", user: null } })).author).toEqual({ name: "Local Dev", login: null, avatarUrl: null });
	});

	it("falls back to the login, then to a placeholder, when the git name is missing", () => {
		expect(toCommit(commitNode({ author: { name: null, user: { login: "octocat", avatarUrl: "https://avatars.githubusercontent.com/u/1" } } })).author.name).toBe("octocat");
		expect(toCommit(commitNode({ author: null })).author.name).toBe(UNKNOWN_COMMIT_AUTHOR);
	});

	it("passes on a file count GitHub could not compute as null", () => {
		expect(toCommit(commitNode({ changedFilesIfAvailable: null })).changedFiles).toBeNull();
	});
});

describe("toContributorStats", () => {
	it("passes `computing` through", () => {
		expect(toContributorStats({ status: "computing" })).toEqual({ status: "computing" });
	});

	it("sums each contributor's weeks and orders by commits, then login", () => {
		const stats = toContributorStats({
			status: "ready",
			stats: [
				contributorStat("zed", [
					[10, 2, 1],
					[5, 1, 1],
				]),
				contributorStat("amy", [[100, 40, 2]]),
				contributorStat("dependabot[bot]", [[1, 1, 5]]),
			],
		});

		expect(stats).toEqual({
			status: "ready",
			contributors: [
				{
					login: "dependabot[bot]",
					avatarUrl: "https://avatars.githubusercontent.com/dependabot[bot]",
					htmlUrl: "https://github.com/dependabot[bot]",
					commits: 5,
					additions: 1,
					deletions: 1,
				},
				{ login: "amy", avatarUrl: "https://avatars.githubusercontent.com/amy", htmlUrl: "https://github.com/amy", commits: 2, additions: 100, deletions: 40 },
				{ login: "zed", avatarUrl: "https://avatars.githubusercontent.com/zed", htmlUrl: "https://github.com/zed", commits: 2, additions: 15, deletions: 3 },
			],
		});
		expect(GithubContributorStatsSchema.safeParse(stats).success).toBe(true);
	});

	it("leaves out commits whose author has no GitHub account any more", () => {
		const stats = toContributorStats({ status: "ready", stats: [{ author: null, total: 3, weeks: [{ a: 1, d: 1, c: 3 }] }, contributorStat("amy", [[1, 0, 1]])] });

		expect(stats.status === "ready" ? stats.contributors.map((contributor) => contributor.login) : []).toEqual(["amy"]);
	});
});

describe("repository lists", () => {
	it("is an empty `off` list without a token", () => {
		expect(GITHUB_INTEGRATION_OFF).toEqual({ source: "off", account: null, repositories: [] });
	});

	it("lists pinned repositories in the configured order, with no push time", () => {
		const list = toConfiguredRepositoryList([REPOSITORY, { owner: "octo-org", repository: "website" }]);

		expect(list).toEqual({
			source: "configured",
			account: null,
			repositories: [
				{ owner: "octo-org", repository: "hello-world", fullName: "octo-org/hello-world", relationship: "configured", pushedAt: null },
				{ owner: "octo-org", repository: "website", fullName: "octo-org/website", relationship: "configured", pushedAt: null },
			],
		});
		expect(GithubRepositoryListSchema.safeParse(list).success).toBe(true);
	});

	it("merges owned and contributed repositories, most recently pushed first, never-pushed last", () => {
		const list = toDiscoveredRepositoryList(
			viewerRepositories(
				[repositoryNode("patelzz007/old", "2025-01-01T00:00:00Z"), repositoryNode("patelzz007/empty", null)],
				[repositoryNode("vercel/next.js", "2026-10-01T00:00:00Z")],
			),
		);

		expect(list.source).toBe("discovered");
		expect(list.account).toBe("patelzz007");
		expect(list.repositories.map((item) => [item.fullName, item.relationship, item.pushedAt])).toEqual([
			["vercel/next.js", "contributed", Date.parse("2026-10-01T00:00:00Z")],
			["patelzz007/old", "owned", Date.parse("2025-01-01T00:00:00Z")],
			["patelzz007/empty", "owned", null],
		]);
		expect(GithubRepositoryListSchema.safeParse(list).success).toBe(true);
	});

	it("lists a repository once, as owned, when GitHub reports it under both kinds (names are case-insensitive)", () => {
		const list = toDiscoveredRepositoryList(
			viewerRepositories([repositoryNode("patelzz007/site", "2026-01-01T00:00:00Z")], [repositoryNode("PatelZZ007/Site", "2026-01-01T00:00:00Z")]),
		);

		expect(list.repositories.map((item) => [item.fullName, item.relationship])).toEqual([["patelzz007/site", "owned"]]);
	});

	it("keeps at most the list maximum", () => {
		const owned = Array.from({ length: GITHUB_REPOSITORY_LIST_MAX }, (_entry: undefined, index: number) => repositoryNode(`patelzz007/own-${String(index)}`, null));
		const contributed = [repositoryNode("vercel/next.js", null)];

		expect(toDiscoveredRepositoryList(viewerRepositories(owned, contributed)).repositories).toHaveLength(GITHUB_REPOSITORY_LIST_MAX);
	});
});

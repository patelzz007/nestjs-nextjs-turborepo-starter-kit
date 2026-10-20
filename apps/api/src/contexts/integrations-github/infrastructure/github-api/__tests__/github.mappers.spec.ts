import {
	GITHUB_COMMIT_DIFF_MAX_LENGTH,
	GITHUB_COMMIT_FILES_MAX,
	GITHUB_COMMIT_MESSAGE_MAX_LENGTH,
	GITHUB_COMMIT_PARENTS_MAX,
	GITHUB_CONTRIBUTORS_MAX,
	GITHUB_FILE_PATCH_MAX_LENGTH,
	GITHUB_REPOSITORY_LIST_MAX,
	GithubCommitDetailSchema,
	GithubCommitPageSchema,
	GithubContributorStatsSchema,
	GithubRepositoryListSchema,
	GithubRepositorySummarySchema,
} from "@workspace/shared";
import { describe, expect, it } from "vitest";

import {
	SHA_A,
	SHA_B,
	commitDetailWire,
	commitFileWire,
	commitHistory,
	commitNode,
	contributionCommit,
	contributorStat,
	repositoryNode,
	summaryNode,
	viewerRepositories,
} from "./github-wire.builders";
import {
	GITHUB_INTEGRATION_OFF,
	UNKNOWN_COMMIT_AUTHOR,
	toCommit,
	toCommitDetail,
	toConfiguredRepositoryList,
	toDiscoveredRepositoryList,
	toCommitPage,
	toHistoryContributors,
	toLanguageShares,
	toRepositoryRef,
	toRepositorySummary,
	toStatisticsContributors,
} from "../github.mappers";

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

describe("toStatisticsContributors", () => {
	it("sums each contributor's weeks, orders by commits then login, and says it is GitHub's statistics", () => {
		const stats = toStatisticsContributors([
			contributorStat("zed", [
				[10, 2, 1],
				[5, 1, 1],
			]),
			contributorStat("amy", [[100, 40, 2]]),
			contributorStat("dependabot[bot]", [[1, 1, 5]]),
		]);

		expect(stats).toEqual({
			status: "ready",
			basis: { kind: "statistics" },
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
		const stats = toStatisticsContributors([{ author: null, total: 3, weeks: [{ a: 1, d: 1, c: 3 }] }, contributorStat("amy", [[1, 0, 1]])]);

		expect(stats.contributors.map((contributor) => contributor.login)).toEqual(["amy"]);
	});
});

describe("toHistoryContributors", () => {
	it("totals each account's commits and lines, ordered by commits then login", () => {
		const stats = toHistoryContributors(
			[contributionCommit("zed", 10, 2), contributionCommit("amy", 100, 40), contributionCommit("zed", 5, 1), contributionCommit("amy", 1, 0)],
			true,
		);

		expect(stats).toEqual({
			status: "ready",
			basis: { kind: "history", commitsCounted: 4, complete: true },
			contributors: [
				{ login: "amy", avatarUrl: "https://avatars.githubusercontent.com/amy", htmlUrl: "https://github.com/amy", commits: 2, additions: 101, deletions: 40 },
				{ login: "zed", avatarUrl: "https://avatars.githubusercontent.com/zed", htmlUrl: "https://github.com/zed", commits: 2, additions: 15, deletions: 3 },
			],
		});
		expect(GithubContributorStatsSchema.safeParse(stats).success).toBe(true);
	});

	it("credits no one for a merge commit or a commit without a GitHub account, but still counts it as read", () => {
		const stats = toHistoryContributors([contributionCommit("amy", 3, 1), contributionCommit("amy", 500, 500, 2), contributionCommit(null, 7, 7)], false);

		expect(stats.basis).toEqual({ kind: "history", commitsCounted: 3, complete: false });
		expect(stats.contributors).toMatchObject([{ login: "amy", commits: 1, additions: 3, deletions: 1 }]);
	});

	it("credits no one in an empty repository", () => {
		expect(toHistoryContributors([], true)).toEqual({ status: "ready", basis: { kind: "history", commitsCounted: 0, complete: true }, contributors: [] });
	});

	it("keeps at most the contract's contributors", () => {
		const commits = Array.from({ length: GITHUB_CONTRIBUTORS_MAX + 1 }, (_entry: undefined, index: number) => contributionCommit(`dev${String(index)}`, 1, 0));

		expect(toHistoryContributors(commits, true).contributors).toHaveLength(GITHUB_CONTRIBUTORS_MAX);
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

/** A patch of exactly `length` characters (its content does not matter to the budget). */
function patchOf(length: number): string {
	return "+".repeat(length);
}

describe("toCommitDetail", () => {
	it("maps every field and satisfies the response contract", () => {
		const detail = toCommitDetail({ commit: commitDetailWire(), filesTruncated: false });

		expect(detail).toEqual({
			sha: SHA_A,
			shortSha: "aaaaaaa",
			headline: "feat: add contributions",
			htmlUrl: `https://github.com/octo-org/hello-world/commit/${SHA_A}`,
			committedAt: Date.parse("2026-10-02T08:30:00Z"),
			author: { name: "Octo Cat", login: "octocat", avatarUrl: "https://avatars.githubusercontent.com/u/1" },
			additions: 2,
			deletions: 1,
			changedFiles: 1,
			message: "feat: add contributions\n\nShows commits and their line counts.",
			parents: [{ sha: SHA_B, shortSha: "bbbbbbb" }],
			files: [{ path: "src/app.ts", previousPath: null, status: "modified", additions: 2, deletions: 1, diff: { kind: "patch", patch: commitFileWire().patch } }],
			filesTruncated: false,
		});
		expect(GithubCommitDetailSchema.safeParse(detail).success).toBe(true);
	});

	it("keeps a rename's previous path", () => {
		const detail = toCommitDetail({
			commit: commitDetailWire({ files: [commitFileWire({ status: "renamed", filename: "src/new.ts", previous_filename: "src/old.ts" })] }),
			filesTruncated: false,
		});

		expect(detail.files).toMatchObject([{ path: "src/new.ts", previousPath: "src/old.ts", status: "renamed" }]);
	});

	it("shows a status GitHub adds later as a plain change", () => {
		const detail = toCommitDetail({ commit: commitDetailWire({ files: [commitFileWire({ status: "transmogrified" })] }), filesTruncated: false });

		expect(detail.files).toMatchObject([{ status: "changed" }]);
	});

	it("says a file has no diff when GitHub sends none (a binary file)", () => {
		const binary = { filename: "logo.png", status: "added", additions: 0, deletions: 0 };

		expect(toCommitDetail({ commit: commitDetailWire({ files: [binary] }), filesTruncated: false }).files).toMatchObject([{ diff: { kind: "unavailable" } }]);
	});

	it("leaves out one file's diff past the per-file limit, keeping the files after it", () => {
		const files = [commitFileWire({ filename: "big.ts", patch: patchOf(GITHUB_FILE_PATCH_MAX_LENGTH + 1) }), commitFileWire({ filename: "small.ts", patch: patchOf(10) })];

		const detail = toCommitDetail({ commit: commitDetailWire({ files }), filesTruncated: false });

		expect(detail.files.map((file) => [file.path, file.diff.kind])).toEqual([
			["big.ts", "too-large"],
			["small.ts", "patch"],
		]);
		expect(GithubCommitDetailSchema.safeParse(detail).success).toBe(true);
	});

	it("stops sending diffs once the commit's budget is spent", () => {
		const perFile = GITHUB_FILE_PATCH_MAX_LENGTH;
		const fitting = GITHUB_COMMIT_DIFF_MAX_LENGTH / perFile;
		const files = Array.from({ length: fitting + 1 }, (_entry: undefined, index: number) => commitFileWire({ filename: `file-${String(index)}.ts`, patch: patchOf(perFile) }));

		const kinds = toCommitDetail({ commit: commitDetailWire({ files }), filesTruncated: false }).files.map((file) => file.diff.kind);

		expect(kinds.filter((kind) => kind === "patch")).toHaveLength(fitting);
		expect(kinds.at(-1)).toBe("too-large");
	});

	it("does not count the file count when GitHub has more files than listed", () => {
		const detail = toCommitDetail({ commit: commitDetailWire(), filesTruncated: true });

		expect(detail).toMatchObject({ changedFiles: null, filesTruncated: true });
	});

	it("keeps at most the contract's files, parents and message length", () => {
		const commit = commitDetailWire({
			commit: { ...commitDetailWire().commit, message: "x".repeat(GITHUB_COMMIT_MESSAGE_MAX_LENGTH + 1) },
			parents: Array.from({ length: GITHUB_COMMIT_PARENTS_MAX + 1 }, () => ({ sha: SHA_B })),
			files: Array.from({ length: GITHUB_COMMIT_FILES_MAX + 1 }, (_entry: undefined, index: number) => commitFileWire({ filename: `f${String(index)}`, patch: patchOf(1) })),
		});

		const detail = toCommitDetail({ commit, filesTruncated: true });

		expect(detail.message).toHaveLength(GITHUB_COMMIT_MESSAGE_MAX_LENGTH);
		expect(detail.parents).toHaveLength(GITHUB_COMMIT_PARENTS_MAX);
		expect(detail.files).toHaveLength(GITHUB_COMMIT_FILES_MAX);
		expect(GithubCommitDetailSchema.safeParse(detail).success).toBe(true);
	});

	it("names an author with neither a git name nor an account", () => {
		const detail = toCommitDetail({ commit: commitDetailWire({ commit: { ...commitDetailWire().commit, author: null }, author: null }), filesTruncated: false });

		expect(detail.author).toEqual({ name: UNKNOWN_COMMIT_AUTHOR, login: null, avatarUrl: null });
	});
});

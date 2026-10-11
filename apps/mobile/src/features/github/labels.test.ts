import { GithubCommitSchema, GithubContributorStatsSchema, GithubRepositoryListSchema, GithubRepositorySummarySchema, type GithubCommit } from "@workspace/shared";

import { NOW_MS, githubCommitJson, githubContributorsJson, githubDiscoveredRepositoriesJson, githubRepositoriesJson, githubSummaryJson } from "../../../test/fixtures";
import {
	changeSummary,
	commitMeta,
	contributorMeta,
	countOf,
	formatCount,
	languageItems,
	lastPushLabel,
	repositoryDescription,
	repositoryListDescription,
	summaryTiles,
} from "./labels";

const SUMMARY = GithubRepositorySummarySchema.parse(githubSummaryJson());

function commit(overrides: Partial<GithubCommit> = {}): GithubCommit {
	return { ...GithubCommitSchema.parse(githubCommitJson({ index: 1 })), ...overrides };
}

describe("GitHub contribution labels", () => {
	it("formats counts with grouping and picks the singular for exactly one", () => {
		expect(formatCount(1204)).toBe("1,204");
		expect(countOf(1, "commit", "commits")).toBe("1 commit");
		expect(countOf(0, "commit", "commits")).toBe("0 commits");
		expect(countOf(1204, "commit", "commits")).toBe("1,204 commits");
	});

	it("headlines commits, stars, forks and open issues", () => {
		expect(summaryTiles(SUMMARY)).toEqual([
			{ label: "Commits", value: "128" },
			{ label: "Stars", value: "1,204" },
			{ label: "Forks", value: "7" },
			{ label: "Open issues", value: "3" },
		]);
	});

	it("lists each language's share", () => {
		expect(languageItems(SUMMARY.languages)).toEqual([
			{ label: "TypeScript", value: "75%" },
			{ label: "CSS", value: "25%" },
		]);
	});

	it("says when the repository was last pushed to, and nothing when it never was", () => {
		expect(lastPushLabel(SUMMARY, NOW_MS)).toBe("Last push 2 hours ago");
		expect(lastPushLabel({ ...SUMMARY, pushedAt: null }, NOW_MS)).toBeNull();
	});

	it("describes a commit by author login, time and files", () => {
		expect(commitMeta(commit(), NOW_MS)).toBe("octocat · 1 hour ago · 4 files");
		expect(commitMeta(commit({ changedFiles: 1 }), NOW_MS)).toBe("octocat · 1 hour ago · 1 file");
	});

	it("falls back to the git name and leaves out files GitHub did not count", () => {
		expect(commitMeta(commit({ author: { name: "Local Dev", login: null, avatarUrl: null }, changedFiles: null }), NOW_MS)).toBe("Local Dev · 1 hour ago");
	});

	it("counts a contributor's commits", () => {
		const stats = GithubContributorStatsSchema.parse(githubContributorsJson(["octocat", "amy"]));
		const commits = stats.status === "ready" ? stats.contributors.map(contributorMeta) : [];
		expect(commits).toEqual(["2 commits", "1 commit"]);
	});

	it("spells out the line counts for screen readers", () => {
		expect(changeSummary(1204, 30)).toBe("1,204 lines added, 30 deleted");
		expect(changeSummary(1, 0)).toBe("1 line added, 0 deleted");
	});

	it("says whose a discovered repository is and when it was pushed; nothing for a pinned one", () => {
		const discovered = GithubRepositoryListSchema.parse(githubDiscoveredRepositoriesJson("patelzz007", ["patelzz007/site"], ["vercel/next.js"]));
		const pinned = GithubRepositoryListSchema.parse(githubRepositoriesJson());

		expect(discovered.repositories.map((repository) => repositoryDescription(repository, NOW_MS))).toEqual([
			"Your repository · pushed 1 day ago",
			"Contributed to · pushed 2 days ago",
		]);
		expect(pinned.repositories.map((repository) => repositoryDescription(repository, NOW_MS))).toEqual([null]);
	});

	it("names the account under the title only for a discovered list", () => {
		expect(repositoryListDescription(GithubRepositoryListSchema.parse(githubDiscoveredRepositoriesJson("patelzz007", ["patelzz007/site"])))).toBe(
			"Public repositories of @patelzz007",
		);
		expect(repositoryListDescription(GithubRepositoryListSchema.parse(githubRepositoriesJson()))).toBeNull();
	});
});

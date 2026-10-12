import {
	GithubCommitDetailSchema,
	GithubCommitSchema,
	GithubContributorStatsSchema,
	GithubRepositoryListSchema,
	GithubRepositorySummarySchema,
	type GithubCommit,
	type GithubCommitDetail,
	type GithubCommitFileStatus,
} from "@workspace/shared";

import {
	NOW_MS,
	githubCommitDetailJson,
	githubCommitJson,
	githubContributorsJson,
	githubDiscoveredRepositoriesJson,
	githubRepositoriesJson,
	githubSummaryJson,
} from "../../../test/fixtures";
import {
	changedFilesSummary,
	changeSummary,
	commitAuthorName,
	commitBody,
	commitMeta,
	contributorBasisNote,
	commitScreenTitle,
	committedLabel,
	fileStatusLabel,
	missingDiffMessage,
	MORE_FILES_ON_GITHUB,
	parentsLabel,
	contributorMeta,
	countOf,
	formatCount,
	languageShares,
	lastPushLabel,
	repositoryDescription,
	repositoryListDescription,
	summaryTiles,
} from "./labels";
import { languageLogoOf } from "./language-logos";

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

	it("lists each language's share with its colours and logo", () => {
		expect(languageShares(SUMMARY.languages)).toEqual([
			{
				name: "TypeScript",
				percent: 75,
				percentLabel: "75%",
				color: "#3178c6",
				tint: "#3178c629",
				logoPath: languageLogoOf("TypeScript")?.path,
				monogram: "Ty",
			},
			{ name: "CSS", percent: 25, percentLabel: "25%", color: "#663399", tint: "#66339929", logoPath: languageLogoOf("CSS")?.path, monogram: "CS" },
		]);
	});

	it("draws a language without a logo as a monogram, and without a colour on the muted surface", () => {
		expect(languageShares([{ name: "C#", color: null, bytes: 10, percent: 100 }])).toEqual([
			{ name: "C#", percent: 100, percentLabel: "100%", color: null, tint: null, logoPath: null, monogram: "C#" },
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
		const commits = stats.contributors.map(contributorMeta);
		expect(commits).toEqual(["2 commits", "1 commit"]);
	});

	it("notes contributors counted from the latest commits only, and nothing for whole-history totals", () => {
		expect(contributorBasisNote({ kind: "history", commitsCounted: 1000, complete: false })).toBe(
			"Counted from the latest 1,000 commits while GitHub prepares its full statistics.",
		);
		expect(contributorBasisNote({ kind: "history", commitsCounted: 173, complete: true })).toBeNull();
		expect(contributorBasisNote({ kind: "statistics" })).toBeNull();
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

const FILE_STATUS_LABEL_CASES: readonly (readonly [GithubCommitFileStatus, string])[] = [
	["added", "Added"],
	["removed", "Deleted"],
	["modified", "Modified"],
	["renamed", "Renamed"],
	["copied", "Copied"],
	["changed", "Changed"],
	["unchanged", "Unchanged"],
];

function commitDetail(overrides: Readonly<Record<string, string | number | boolean>> = {}): GithubCommitDetail {
	return GithubCommitDetailSchema.parse(githubCommitDetailJson(1, overrides));
}

describe("GitHub commit labels", () => {
	it("titles the screen with the short SHA, or plainly before it is known", () => {
		expect(commitScreenTitle("a1b2c3d")).toBe("Commit a1b2c3d");
		expect(commitScreenTitle(null)).toBe("Commit");
	});

	it("separates the message's body from its headline", () => {
		expect(commitBody(commitDetail())).toBe("Shows each commit's changed files.");
		expect(commitBody(commitDetail({ message: "feat: add contributions" }))).toBeNull();
		expect(commitBody(commitDetail({ message: "feat: add contributions\n\n   \n" }))).toBeNull();
	});

	it("names the author by login, or by git name without an account, and says when they committed", () => {
		expect(commitAuthorName(commitDetail())).toBe("octocat");
		expect(commitAuthorName(commit({ author: { name: "Local Dev", login: null, avatarUrl: null } }))).toBe("Local Dev");
		expect(committedLabel(commitDetail(), NOW_MS)).toBe("committed 1 hour ago");
	});

	it("counts parents", () => {
		expect(parentsLabel(1)).toBe("1 parent");
		expect(parentsLabel(2)).toBe("2 parents");
	});

	it("sums up the changed files the way GitHub does", () => {
		expect(changedFilesSummary(commitDetail())).toBe("Showing 3 changed files with 2 additions and 1 deletion.");
		expect(changedFilesSummary(commitDetail({ additions: 1, deletions: 1204 }))).toBe("Showing 3 changed files with 1 addition and 1,204 deletions.");
		expect(MORE_FILES_ON_GITHUB).toBe("This commit changed more than 100 files. Open it on GitHub to see the rest.");
	});

	it.each(FILE_STATUS_LABEL_CASES)("calls a %s file %j", (status: GithubCommitFileStatus, label: string) => {
		expect(fileStatusLabel(status)).toBe(label);
	});

	it("explains a missing diff, and says nothing when there is one", () => {
		expect(missingDiffMessage({ kind: "too-large" })).toBe("This diff is too large to show here. Open the commit on GitHub to read it.");
		expect(missingDiffMessage({ kind: "unavailable" })).toBe("There's no text diff for this file. It may be binary, or only renamed.");
		expect(missingDiffMessage({ kind: "patch", patch: "@@ -1 +1 @@" })).toBeNull();
	});
});

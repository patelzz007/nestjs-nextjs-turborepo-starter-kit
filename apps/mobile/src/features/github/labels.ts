// What the GitHub contributions section says — counts, plurals, the line
// under each commit — derived from the API's payloads. Pure, so the copy is
// tested without rendering.

import {
	GITHUB_COMMIT_FILES_MAX,
	PLATFORM_DISPLAY_REGION,
	type GithubCommit,
	type GithubCommitDetail,
	type GithubCommitFileDiff,
	type GithubCommitFileStatus,
	type GithubContributor,
	type GithubLanguageShare,
	type GithubRepositoryList,
	type GithubRepositoryListItem,
	type GithubRepositoryRelationship,
	type GithubRepositorySummary,
} from "@workspace/shared";

import type { DetailItem } from "../../components/detail-list";
import type { StatTile } from "../../components/stat-tiles";
import { formatRelativeTime } from "../../lib/time-format";

/** Shown when the phone cannot open a GitHub page (a commit, a profile). */
export const OPEN_GITHUB_FAILED_MESSAGE = "Couldn't open GitHub. Try again from a browser.";

/** Separates the parts of a row's context line ("octocat · 2 hours ago · 4 files"). */
const META_SEPARATOR = " · ";

const COUNT_FORMAT = new Intl.NumberFormat(PLATFORM_DISPLAY_REGION.locale);

/** `1204` → "1,204" in the platform's display region. */
export function formatCount(count: number): string {
	return COUNT_FORMAT.format(count);
}

/** "1 commit", "1,204 commits". */
export function countOf(count: number, singular: string, plural: string): string {
	return `${formatCount(count)} ${count === 1 ? singular : plural}`;
}

/** The headline numbers of a repository. */
export function summaryTiles(summary: GithubRepositorySummary): StatTile[] {
	return [
		{ label: "Commits", value: formatCount(summary.totalCommits) },
		{ label: "Stars", value: formatCount(summary.stars) },
		{ label: "Forks", value: formatCount(summary.forks) },
		{ label: "Open issues", value: formatCount(summary.openIssues) },
	];
}

/** Each language and its share of the code ("TypeScript: 82.4%"). */
export function languageItems(languages: readonly GithubLanguageShare[]): DetailItem[] {
	return languages.map((language: GithubLanguageShare): DetailItem => ({ label: language.name, value: `${String(language.percent)}%` }));
}

/** "Last push 2 hours ago", or `null` for a repository nobody has pushed to. */
export function lastPushLabel(summary: GithubRepositorySummary, nowMs: number): string | null {
	return summary.pushedAt === null ? null : `Last push ${formatRelativeTime(summary.pushedAt, nowMs)}`;
}

/** Who and when, plus the number of files when GitHub counted them. */
export function commitMeta(commit: GithubCommit, nowMs: number): string {
	const parts = [commit.author.login ?? commit.author.name, formatRelativeTime(commit.committedAt, nowMs)];
	return (commit.changedFiles === null ? parts : [...parts, countOf(commit.changedFiles, "file", "files")]).join(META_SEPARATOR);
}

/** "12 commits". */
export function contributorMeta(contributor: GithubContributor): string {
	return countOf(contributor.commits, "commit", "commits");
}

/** What screen readers say for the +/− counts of a row. */
export function changeSummary(additions: number, deletions: number): string {
	return `${countOf(additions, "line", "lines")} added, ${formatCount(deletions)} deleted`;
}

const RELATIONSHIP_LABELS: Readonly<Record<GithubRepositoryRelationship, string | null>> = {
	configured: null,
	owned: "Your repository",
	contributed: "Contributed to",
};

/** Under a repository in the picker: whose it is and when it was last pushed ("Your repository · pushed 2 days ago"). */
export function repositoryDescription(repository: GithubRepositoryListItem, nowMs: number): string | null {
	const parts = [RELATIONSHIP_LABELS[repository.relationship], repository.pushedAt === null ? null : `pushed ${formatRelativeTime(repository.pushedAt, nowMs)}`].flatMap(
		(part: string | null): string[] => (part === null ? [] : [part]),
	);
	return parts.length === 0 ? null : parts.join(META_SEPARATOR);
}

/** Under the section title for a discovered list ("Public repositories of @patelzz007"); `null` for a pinned one. */
export function repositoryListDescription(listing: GithubRepositoryList): string | null {
	return listing.source === "discovered" && listing.account !== null ? `Public repositories of @${listing.account}` : null;
}

// ── One commit ─────────────────────────────────────────────────────────────

/** The header's title on a commit's screen ("Commit a1b2c3d"), or just "Commit" before its SHA is known. */
export function commitScreenTitle(shortSha: string | null): string {
	return shortSha === null ? "Commit" : `Commit ${shortSha}`;
}

/** The message after its headline (the description), or `null` when the commit has none. */
export function commitBody(commit: GithubCommitDetail): string | null {
	const body = commit.message.slice(commit.headline.length).trim();
	return body.length === 0 ? null : body;
}

/** Who wrote the commit, as GitHub names them: their login, or their git name without an account. */
export function commitAuthorName(commit: GithubCommit): string {
	return commit.author.login ?? commit.author.name;
}

/** "committed 2 hours ago" — after the author's name. */
export function committedLabel(commit: GithubCommit, nowMs: number): string {
	return `committed ${formatRelativeTime(commit.committedAt, nowMs)}`;
}

/** "1 parent", "2 parents" — a merge has two. */
export function parentsLabel(count: number): string {
	return count === 1 ? "1 parent" : `${formatCount(count)} parents`;
}

/** "Showing 4 changed files with 120 additions and 30 deletions." — GitHub's line above the files. */
export function changedFilesSummary(commit: GithubCommitDetail): string {
	const files = countOf(commit.files.length, "changed file", "changed files");
	return `Showing ${files} with ${countOf(commit.additions, "addition", "additions")} and ${countOf(commit.deletions, "deletion", "deletions")}.`;
}

/** Shown when the commit changed more files than the API sends. */
export const MORE_FILES_ON_GITHUB = `This commit changed more than ${formatCount(GITHUB_COMMIT_FILES_MAX)} files. Open it on GitHub to see the rest.`;

const FILE_STATUS_LABELS: Readonly<Record<GithubCommitFileStatus, string>> = {
	added: "Added",
	removed: "Deleted",
	modified: "Modified",
	renamed: "Renamed",
	copied: "Copied",
	changed: "Changed",
	unchanged: "Unchanged",
};

/** What happened to a file, in words ("Modified"). */
export function fileStatusLabel(status: GithubCommitFileStatus): string {
	return FILE_STATUS_LABELS[status];
}

const MISSING_DIFF_MESSAGES: Readonly<Record<Exclude<GithubCommitFileDiff["kind"], "patch">, string>> = {
	"too-large": "This diff is too large to show here. Open the commit on GitHub to read it.",
	unavailable: "There's no text diff for this file. It may be binary, or only renamed.",
};

/** Why a file shows no diff; `null` when it has one. */
export function missingDiffMessage(diff: GithubCommitFileDiff): string | null {
	return diff.kind === "patch" ? null : MISSING_DIFF_MESSAGES[diff.kind];
}

// ============================================
// github.mappers.ts - GitHub's shapes → the shared contract
// ============================================
// Pure functions over already-validated wire data (github.wire-schemas.ts).
// The response interceptor validates the result against the contract again.

import {
	epochMs,
	GITHUB_COMMIT_DIFF_MAX_LENGTH,
	GITHUB_COMMIT_FILES_MAX,
	GITHUB_COMMIT_MESSAGE_MAX_LENGTH,
	GITHUB_COMMIT_PARENTS_MAX,
	GITHUB_CONTRIBUTORS_MAX,
	GITHUB_FILE_PATCH_MAX_LENGTH,
	GITHUB_REPOSITORY_LIST_MAX,
	GithubCommitFileStatusSchema,
	GithubLanguageShareSchema,
	toGithubFullName,
	type GithubCommit,
	type GithubCommitDetail,
	type GithubCommitFile,
	type GithubCommitFileDiff,
	type GithubCommitPage,
	type GithubCommitParent,
	type GithubContributor,
	type GithubContributorStats,
	type GithubLanguageShare,
	type GithubRepositoryList,
	type GithubRepositoryListItem,
	type GithubRepositoryParams,
	type GithubRepositoryRef,
	type GithubRepositoryRelationship,
	type GithubRepositorySummary,
} from "@workspace/shared";

import type { GithubCommitDetailResult } from "./github-api.client";
import type {
	GithubCommitDetailWire,
	GithubCommitFileWire,
	GithubCommitHistoryWire,
	GithubCommitNodeWire,
	GithubContributionCommitWire,
	GithubContributorStatWire,
	GithubRepositoryNodeWire,
	GithubRepositorySummaryNodeWire,
	GithubViewerRepositoriesWire,
} from "./github.wire-schemas";

const PERCENT = 100;
/** Language shares are rounded to one decimal place (`82.4`). */
const PERCENT_DECIMAL_FACTOR = 10;

/** Shown when a commit's author has neither a git name nor a GitHub account. */
export const UNKNOWN_COMMIT_AUTHOR = "Unknown author";

/** GitHub's own abbreviation of a commit id (`a1b2c3d`). */
export const SHORT_SHA_LENGTH = 7;

/** A file status GitHub adds later is shown as a plain change, not refused. */
const FileStatusSchema = GithubCommitFileStatusSchema.catch("changed");

/** Ends the headline of a commit message. */
const LINE_BREAK = "\n";

export function toRepositoryRef(params: GithubRepositoryParams): GithubRepositoryRef {
	return { owner: params.owner, repository: params.repository, fullName: toGithubFullName(params) };
}

/** No `GITHUB_TOKEN`: nothing to read. */
export const GITHUB_INTEGRATION_OFF: GithubRepositoryList = { source: "off", account: null, repositories: [] };

/** The repositories pinned by `GITHUB_REPOSITORIES`, in the configured order. */
export function toConfiguredRepositoryList(pinned: readonly GithubRepositoryParams[]): GithubRepositoryList {
	return {
		source: "configured",
		account: null,
		repositories: pinned.map((params: GithubRepositoryParams): GithubRepositoryListItem => ({ ...toRepositoryRef(params), relationship: "configured", pushedAt: null })),
	};
}

/**
 * The token account's own repositories and the ones it contributed to, each
 * once (a repository it owns is listed as owned), most recently pushed first.
 */
export function toDiscoveredRepositoryList(viewer: GithubViewerRepositoriesWire): GithubRepositoryList {
	const candidates: readonly GithubRepositoryListItem[] = [
		...viewer.repositories.nodes.map((node: GithubRepositoryNodeWire): GithubRepositoryListItem => toListItem(node, "owned")),
		...viewer.repositoriesContributedTo.nodes.map((node: GithubRepositoryNodeWire): GithubRepositoryListItem => toListItem(node, "contributed")),
	];
	const seen = new Set<string>();
	const unique = candidates.filter((item: GithubRepositoryListItem): boolean => {
		const key = item.fullName.toLowerCase();
		if (seen.has(key)) {
			return false;
		}
		seen.add(key);
		return true;
	});
	return { source: "discovered", account: viewer.login, repositories: unique.sort(byMostRecentPush).slice(0, GITHUB_REPOSITORY_LIST_MAX) };
}

function toListItem(node: GithubRepositoryNodeWire, relationship: GithubRepositoryRelationship): GithubRepositoryListItem {
	return {
		...toRepositoryRef({ owner: node.owner.login, repository: node.name }),
		relationship,
		pushedAt: node.pushedAt === null ? null : epochMs(Date.parse(node.pushedAt)),
	};
}

/** Most recent push first; never-pushed repositories last. */
function byMostRecentPush(left: GithubRepositoryListItem, right: GithubRepositoryListItem): number {
	return (right.pushedAt ?? 0) - (left.pushedAt ?? 0);
}

export function toRepositorySummary(params: GithubRepositoryParams, node: GithubRepositorySummaryNodeWire): GithubRepositorySummary {
	return {
		...toRepositoryRef(params),
		description: node.description,
		htmlUrl: node.url,
		defaultBranch: node.defaultBranchRef?.name ?? null,
		primaryLanguage: node.primaryLanguage?.name ?? null,
		stars: node.stargazerCount,
		forks: node.forkCount,
		watchers: node.watchers.totalCount,
		openIssues: node.issues.totalCount,
		totalCommits: node.defaultBranchRef?.target?.history?.totalCount ?? 0,
		pushedAt: node.pushedAt === null ? null : epochMs(Date.parse(node.pushedAt)),
		languages: toLanguageShares(node.languages.edges),
	};
}

/** Each language's share of the listed languages' bytes. A colour GitHub sends in another format is dropped, not passed on. */
export function toLanguageShares(edges: GithubRepositorySummaryNodeWire["languages"]["edges"]): GithubLanguageShare[] {
	const totalBytes = edges.reduce((sum: number, edge): number => sum + edge.size, 0);
	return edges.map((edge): GithubLanguageShare => ({
		name: edge.node.name,
		color: GithubLanguageShareSchema.shape.color.safeParse(edge.node.color).data ?? null,
		bytes: edge.size,
		percent: totalBytes === 0 ? 0 : Math.round((edge.size / totalBytes) * PERCENT * PERCENT_DECIMAL_FACTOR) / PERCENT_DECIMAL_FACTOR,
	}));
}

/** One page of history; an empty repository (`history === null`) is an empty last page. */
export function toCommitPage(history: GithubCommitHistoryWire | null): GithubCommitPage {
	if (history === null) {
		return { items: [], nextCursor: null, totalCommits: 0 };
	}
	return {
		items: history.nodes.map(toCommit),
		nextCursor: history.pageInfo.hasNextPage ? history.pageInfo.endCursor : null,
		totalCommits: history.totalCount,
	};
}

export function toCommit(node: GithubCommitNodeWire): GithubCommit {
	const user = node.author?.user ?? null;
	return {
		sha: node.oid,
		shortSha: node.abbreviatedOid,
		headline: node.messageHeadline,
		htmlUrl: node.url,
		committedAt: epochMs(Date.parse(node.committedDate)),
		author: {
			name: node.author?.name ?? user?.login ?? UNKNOWN_COMMIT_AUTHOR,
			login: user?.login ?? null,
			avatarUrl: user?.avatarUrl ?? null,
		},
		additions: node.additions,
		deletions: node.deletions,
		changedFiles: node.changedFilesIfAvailable,
	};
}

/** Most commits first, then by login — the order GitHub lists contributors in. */
function byCommitsThenLogin(left: GithubContributor, right: GithubContributor): number {
	return right.commits - left.commits || left.login.localeCompare(right.login);
}

/**
 * GitHub's contributor statistics: each contributor's commits, and the lines
 * they added and deleted summed over every week. Commits by authors with no
 * GitHub account any more (`author: null`) have no one to credit and are left out.
 */
export function toStatisticsContributors(stats: readonly GithubContributorStatWire[]): GithubContributorStats {
	const contributors = stats.flatMap((stat: GithubContributorStatWire): GithubContributor[] => {
		if (stat.author === null) {
			return [];
		}
		return [
			{
				login: stat.author.login,
				avatarUrl: stat.author.avatar_url,
				htmlUrl: stat.author.html_url,
				commits: stat.total,
				additions: stat.weeks.reduce((sum: number, week): number => sum + week.a, 0),
				deletions: stat.weeks.reduce((sum: number, week): number => sum + week.d, 0),
			},
		];
	});
	return { status: "ready", basis: { kind: "statistics" }, contributors: contributors.sort(byCommitsThenLogin).slice(0, GITHUB_CONTRIBUTORS_MAX) };
}

/** A merge commit only joins histories: like GitHub's statistics, it is credited to no one. */
const MERGE_PARENTS = 2;

/**
 * Contributor totals counted from the default branch's latest commits (newest
 * first, as read), for when GitHub's statistics are not ready. Credited like
 * GitHub's: per GitHub account, merge commits and commits without an account
 * left out. `complete` when `commits` is the whole history.
 */
export function toHistoryContributors(commits: readonly GithubContributionCommitWire[], complete: boolean): GithubContributorStats {
	const totals = new Map<string, GithubContributor>();
	for (const commit of commits) {
		const user = commit.author?.user ?? null;
		if (user === null || commit.parents.totalCount >= MERGE_PARENTS) {
			continue;
		}
		const previous = totals.get(user.login) ?? { login: user.login, avatarUrl: user.avatarUrl, htmlUrl: user.url, commits: 0, additions: 0, deletions: 0 };
		totals.set(user.login, {
			...previous,
			commits: previous.commits + 1,
			additions: previous.additions + commit.additions,
			deletions: previous.deletions + commit.deletions,
		});
	}
	return {
		status: "ready",
		basis: { kind: "history", commitsCounted: commits.length, complete },
		contributors: [...totals.values()].sort(byCommitsThenLogin).slice(0, GITHUB_CONTRIBUTORS_MAX),
	};
}

/**
 * One commit with its files. Diffs are passed on while they fit: one file's
 * up to {@link GITHUB_FILE_PATCH_MAX_LENGTH} characters, all files together up
 * to {@link GITHUB_COMMIT_DIFF_MAX_LENGTH} (in GitHub's order) — past that a
 * file is `too-large`, so one answer stays small enough for a phone.
 */
export function toCommitDetail({ commit, filesTruncated }: GithubCommitDetailResult): GithubCommitDetail {
	const files = toChangedFiles(commit.files);
	const message = commit.commit.message.slice(0, GITHUB_COMMIT_MESSAGE_MAX_LENGTH);
	const [headline = ""] = message.split(LINE_BREAK);
	const user = commit.author;
	return {
		sha: commit.sha,
		shortSha: commit.sha.slice(0, SHORT_SHA_LENGTH),
		headline,
		htmlUrl: commit.html_url,
		committedAt: epochMs(Date.parse(commit.commit.committer.date)),
		author: {
			name: commit.commit.author?.name ?? user?.login ?? UNKNOWN_COMMIT_AUTHOR,
			login: user?.login ?? null,
			avatarUrl: user?.avatar_url ?? null,
		},
		additions: commit.stats.additions,
		deletions: commit.stats.deletions,
		changedFiles: filesTruncated ? null : files.length,
		message,
		parents: commit.parents.slice(0, GITHUB_COMMIT_PARENTS_MAX).map(toCommitParent),
		files,
		filesTruncated,
	};
}

/**
 * The first {@link GITHUB_COMMIT_FILES_MAX} changed files with their diffs,
 * each diff within its own limit and all of them within one shared budget (in
 * GitHub's order) — a commit's files, and a page of a pull request's files.
 */
export function toChangedFiles(wireFiles: readonly GithubCommitFileWire[]): GithubCommitFile[] {
	const files: GithubCommitFile[] = [];
	let diffBudget = GITHUB_COMMIT_DIFF_MAX_LENGTH;
	for (const file of wireFiles.slice(0, GITHUB_COMMIT_FILES_MAX)) {
		const diff = toFileDiff(file, diffBudget);
		diffBudget -= diff.kind === "patch" ? diff.patch.length : 0;
		files.push(toCommitFile(file, diff));
	}
	return files;
}

function toCommitParent(parent: GithubCommitDetailWire["parents"][number]): GithubCommitParent {
	return { sha: parent.sha, shortSha: parent.sha.slice(0, SHORT_SHA_LENGTH) };
}

/** A file's diff, if GitHub sent one and it fits both this file's limit and what is left of the commit's. */
function toFileDiff(file: GithubCommitFileWire, diffBudget: number): GithubCommitFileDiff {
	const patch = file.patch ?? "";
	if (patch.length === 0) {
		return { kind: "unavailable" };
	}
	if (patch.length > GITHUB_FILE_PATCH_MAX_LENGTH || patch.length > diffBudget) {
		return { kind: "too-large" };
	}
	return { kind: "patch", patch };
}

function toCommitFile(file: GithubCommitFileWire, diff: GithubCommitFileDiff): GithubCommitFile {
	return {
		path: file.filename,
		previousPath: file.previous_filename ?? null,
		status: FileStatusSchema.parse(file.status),
		additions: file.additions,
		deletions: file.deletions,
		diff,
	};
}

// ============================================
// github.mappers.ts - GitHub's shapes → the shared contract
// ============================================
// Pure functions over already-validated wire data (github.wire-schemas.ts).
// The response interceptor validates the result against the contract again.

import {
	epochMs,
	GITHUB_REPOSITORY_LIST_MAX,
	GithubLanguageShareSchema,
	toGithubFullName,
	type GithubCommit,
	type GithubCommitPage,
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

import type { GithubContributorStatsResult } from "./github-api.client";
import type {
	GithubCommitHistoryWire,
	GithubCommitNodeWire,
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

/**
 * Contributors by commits (most first, then by login), each with the lines
 * they added and deleted summed over every week. Commits by authors with no
 * GitHub account any more (`author: null`) have no one to credit and are left out.
 */
export function toContributorStats(result: GithubContributorStatsResult): GithubContributorStats {
	if (result.status === "computing") {
		return { status: "computing" };
	}
	const contributors = result.stats
		.flatMap((stat: GithubContributorStatWire): GithubContributor[] => {
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
		})
		.sort((left: GithubContributor, right: GithubContributor): number => right.commits - left.commits || left.login.localeCompare(right.login));
	return { status: "ready", contributors };
}

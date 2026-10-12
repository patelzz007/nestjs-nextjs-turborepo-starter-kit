// Builders for GitHub's wire shapes — every spec starts from a complete,
// valid answer and overrides only what it is about.

import type {
	GithubCommitDetailWire,
	GithubCommitFileWire,
	GithubCommitHistoryWire,
	GithubCommitNodeWire,
	GithubContributorStatWire,
	GithubRepositoryNodeWire,
	GithubRepositorySummaryNodeWire,
	GithubViewerRepositoriesWire,
} from "../github.wire-schemas";

export const SHA_A = "a".repeat(40);
export const SHA_B = "b".repeat(40);

export function summaryNode(overrides: Partial<GithubRepositorySummaryNodeWire> = {}): GithubRepositorySummaryNodeWire {
	return {
		description: "A hello world repository",
		url: "https://github.com/octo-org/hello-world",
		stargazerCount: 42,
		forkCount: 7,
		watchers: { totalCount: 5 },
		issues: { totalCount: 3 },
		primaryLanguage: { name: "TypeScript" },
		pushedAt: "2026-10-01T12:00:00Z",
		defaultBranchRef: { name: "main", target: { history: { totalCount: 128 } } },
		languages: {
			edges: [
				{ size: 750, node: { name: "TypeScript", color: "#3178c6" } },
				{ size: 250, node: { name: "CSS", color: "#663399" } },
			],
		},
		...overrides,
	};
}

export function commitNode(overrides: Partial<GithubCommitNodeWire> = {}): GithubCommitNodeWire {
	return {
		oid: SHA_A,
		abbreviatedOid: "aaaaaaa",
		messageHeadline: "feat: add contributions",
		url: `https://github.com/octo-org/hello-world/commit/${SHA_A}`,
		committedDate: "2026-10-02T08:30:00Z",
		additions: 120,
		deletions: 30,
		changedFilesIfAvailable: 4,
		author: { name: "Octo Cat", user: { login: "octocat", avatarUrl: "https://avatars.githubusercontent.com/u/1" } },
		...overrides,
	};
}

export function commitHistory(overrides: Partial<GithubCommitHistoryWire> = {}): GithubCommitHistoryWire {
	return {
		totalCount: 128,
		pageInfo: { hasNextPage: true, endCursor: `${SHA_A} 19` },
		nodes: [commitNode(), commitNode({ oid: SHA_B, abbreviatedOid: "bbbbbbb", url: `https://github.com/octo-org/hello-world/commit/${SHA_B}` })],
		...overrides,
	};
}

export function contributorStat(login: string, weeks: readonly (readonly [added: number, deleted: number, commits: number])[]): GithubContributorStatWire {
	return {
		author: { login, avatar_url: `https://avatars.githubusercontent.com/${login}`, html_url: `https://github.com/${login}` },
		total: weeks.reduce((sum: number, [, , commits]): number => sum + commits, 0),
		weeks: weeks.map(([a, d, c]) => ({ a, d, c })),
	};
}

/** One repository as discovery lists it (`owner/name`, last push or `null`). */
export function repositoryNode(fullName: string, pushedAt: string | null): GithubRepositoryNodeWire {
	const [owner = "", name = ""] = fullName.split("/");
	return { name, owner: { login: owner }, pushedAt };
}

export function viewerRepositories(owned: readonly GithubRepositoryNodeWire[], contributed: readonly GithubRepositoryNodeWire[] = []): GithubViewerRepositoriesWire {
	return { login: "patelzz007", repositories: { nodes: [...owned] }, repositoriesContributedTo: { nodes: [...contributed] } };
}

/** One changed file: a two-line change to `src/app.ts` unless overridden. */
export function commitFileWire(overrides: Partial<GithubCommitFileWire> = {}): GithubCommitFileWire {
	return {
		filename: "src/app.ts",
		status: "modified",
		additions: 2,
		deletions: 1,
		patch: '@@ -1,3 +1,4 @@\n import { a } from "./a";\n-const b = 1;\n+const b = 2;\n+const c = 3;',
		...overrides,
	};
}

/** `GET /repos/{owner}/{repo}/commits/{sha}` for {@link SHA_A}, one parent ({@link SHA_B}) and one file. */
export function commitDetailWire(overrides: Partial<GithubCommitDetailWire> = {}): GithubCommitDetailWire {
	return {
		sha: SHA_A,
		html_url: `https://github.com/octo-org/hello-world/commit/${SHA_A}`,
		commit: {
			message: "feat: add contributions\n\nShows commits and their line counts.",
			author: { name: "Octo Cat", date: "2026-10-02T08:00:00Z" },
			committer: { name: "GitHub", date: "2026-10-02T08:30:00Z" },
		},
		author: { login: "octocat", avatar_url: "https://avatars.githubusercontent.com/u/1" },
		parents: [{ sha: SHA_B }],
		stats: { additions: 2, deletions: 1 },
		files: [commitFileWire()],
		...overrides,
	};
}

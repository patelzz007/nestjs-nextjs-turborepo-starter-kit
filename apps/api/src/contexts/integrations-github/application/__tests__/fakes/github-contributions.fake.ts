import {
	GithubCommitDetailSchema,
	GithubCommitPageSchema,
	GithubContributorStatsSchema,
	GithubRepositoryListSchema,
	GithubRepositorySummarySchema,
	type GithubCommitDetail,
	type GithubCommitHistoryQuery,
	type GithubCommitPage,
	type GithubCommitParams,
	type GithubContributorStats,
	type GithubRepositoryList,
	type GithubRepositoryParams,
	type GithubRepositorySummary,
} from "@workspace/shared";

import { GithubRepositoryNotConfiguredError } from "../../errors/github.errors";
import type { GithubContributionsPort } from "../../ports/github-contributions.port";
import { COMMIT_DETAIL } from "./github-contract.fixtures";

export const SUMMARY: GithubRepositorySummary = GithubRepositorySummarySchema.parse({
	owner: "Octo-Org",
	repository: "Hello-World",
	fullName: "Octo-Org/Hello-World",
	description: null,
	htmlUrl: "https://github.com/Octo-Org/Hello-World",
	defaultBranch: "main",
	primaryLanguage: null,
	stars: 0,
	forks: 0,
	watchers: 0,
	openIssues: 0,
	totalCommits: 0,
	pushedAt: null,
	languages: [],
});

const LISTED = { owner: "Octo-Org", repository: "Hello-World" };

/** The repositories the API may read with the server's token, and canned answers for them. */
export class FakeContributions implements GithubContributionsPort {
	public readonly asked: string[] = [];

	public listRepositories(): Promise<GithubRepositoryList> {
		this.asked.push("list");
		return Promise.resolve(GithubRepositoryListSchema.parse({ source: "off", account: null, repositories: [] }));
	}

	public getRepositorySummary(requested: GithubRepositoryParams): Promise<GithubRepositorySummary> {
		return this.allowed(requested, "summary", () => SUMMARY);
	}

	public getCommitPage(requested: GithubRepositoryParams, query: GithubCommitHistoryQuery): Promise<GithubCommitPage> {
		return this.allowed(requested, `page:${String(query.limit)}:${query.cursor ?? ""}`, () => GithubCommitPageSchema.parse({ items: [], nextCursor: null, totalCommits: 0 }));
	}

	public getCommit(requested: GithubCommitParams): Promise<GithubCommitDetail> {
		return this.allowed(requested, `commit:${requested.sha}`, () => GithubCommitDetailSchema.parse(COMMIT_DETAIL));
	}

	public getContributorStats(requested: GithubRepositoryParams): Promise<GithubContributorStats> {
		return this.allowed(requested, "contributors", () => GithubContributorStatsSchema.parse({ status: "ready", basis: { kind: "statistics" }, contributors: [] }));
	}

	private allowed<T>(requested: GithubRepositoryParams, view: string, answer: () => T): Promise<T> {
		this.asked.push(view);
		if (`${requested.owner}/${requested.repository}`.toLowerCase() !== `${LISTED.owner}/${LISTED.repository}`.toLowerCase()) {
			return Promise.reject(new GithubRepositoryNotConfiguredError(requested));
		}
		return Promise.resolve(answer());
	}
}

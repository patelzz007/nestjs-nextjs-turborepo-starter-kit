import { describe, expect, it } from "vitest";

import { GithubRepositoryNotConfiguredError } from "../errors/github.errors";
import { GetGithubCommitHandler } from "../queries/get-github-commit/get-github-commit.handler";
import { GetGithubCommitQuery } from "../queries/get-github-commit/get-github-commit.query";
import { GetGithubCommitPageHandler } from "../queries/get-github-commit-page/get-github-commit-page.handler";
import { GetGithubCommitPageQuery } from "../queries/get-github-commit-page/get-github-commit-page.query";
import { GetGithubContributorStatsHandler } from "../queries/get-github-contributor-stats/get-github-contributor-stats.handler";
import { GetGithubContributorStatsQuery } from "../queries/get-github-contributor-stats/get-github-contributor-stats.query";
import { GetGithubRepositorySummaryHandler } from "../queries/get-github-repository-summary/get-github-repository-summary.handler";
import { GetGithubRepositorySummaryQuery } from "../queries/get-github-repository-summary/get-github-repository-summary.query";
import { ListGithubRepositoriesHandler } from "../queries/list-github-repositories/list-github-repositories.handler";
import { ListGithubRepositoriesQuery } from "../queries/list-github-repositories/list-github-repositories.query";
import { HEAD_SHA, REPOSITORY, userActor } from "./fakes/github-contract.fixtures";
import { FakeContributions, SUMMARY } from "./fakes/github-contributions.fake";

describe("contribution queries", () => {
	it("lists the repositories the API may read", async () => {
		const contributions = new FakeContributions();

		await expect(new ListGithubRepositoriesHandler(contributions).execute(new ListGithubRepositoriesQuery(userActor()))).resolves.toEqual({
			source: "off",
			account: null,
			repositories: [],
		});
	});

	it("answers each per-repository read for a listed repository, in the listed spelling", async () => {
		const contributions = new FakeContributions();

		await expect(new GetGithubRepositorySummaryHandler(contributions).execute(new GetGithubRepositorySummaryQuery(userActor(), REPOSITORY))).resolves.toBe(SUMMARY);
		await expect(
			new GetGithubCommitPageHandler(contributions).execute(new GetGithubCommitPageQuery(userActor(), { params: REPOSITORY, query: { limit: 5, cursor: "c" } })),
		).resolves.toMatchObject({ items: [] });
		await expect(new GetGithubCommitHandler(contributions).execute(new GetGithubCommitQuery(userActor(), { ...REPOSITORY, sha: HEAD_SHA }))).resolves.toMatchObject({
			sha: HEAD_SHA,
		});
		await expect(new GetGithubContributorStatsHandler(contributions).execute(new GetGithubContributorStatsQuery(userActor(), REPOSITORY))).resolves.toMatchObject({
			status: "ready",
		});
		expect(contributions.asked).toEqual(["summary", "page:5:c", `commit:${HEAD_SHA}`, "contributors"]);
	});

	it("passes on the 404 for a repository outside the list", async () => {
		await expect(
			new GetGithubRepositorySummaryHandler(new FakeContributions()).execute(new GetGithubRepositorySummaryQuery(userActor(), { owner: "someone", repository: "secret" })),
		).rejects.toBeInstanceOf(GithubRepositoryNotConfiguredError);
	});
});

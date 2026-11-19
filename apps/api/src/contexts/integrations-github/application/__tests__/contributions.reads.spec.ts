import { describe, expect, it } from "vitest";

import { GithubRepositoryNotConfiguredError } from "../errors/github.errors";
import { GithubContributionsApplicationService } from "../services/github-contributions.application-service";
import { HEAD_SHA, REPOSITORY } from "./fakes/github-contract.fixtures";
import { FakeContributions, SUMMARY } from "./fakes/github-contributions.fake";

describe("GithubContributionsApplicationService", () => {
	it("lists the repositories the API may read", async () => {
		await expect(new GithubContributionsApplicationService(new FakeContributions()).repositories()).resolves.toEqual({
			source: "off",
			account: null,
			repositories: [],
		});
	});

	it("answers each per-repository read for a listed repository, in the listed spelling", async () => {
		const contributions = new FakeContributions();
		const service = new GithubContributionsApplicationService(contributions);

		await expect(service.repositorySummary(REPOSITORY)).resolves.toBe(SUMMARY);
		await expect(service.commitPage(REPOSITORY, { limit: 5, cursor: "c" })).resolves.toMatchObject({ items: [] });
		await expect(service.commit({ ...REPOSITORY, sha: HEAD_SHA })).resolves.toMatchObject({ sha: HEAD_SHA });
		await expect(service.contributorStats(REPOSITORY)).resolves.toMatchObject({ status: "ready" });
		expect(contributions.asked).toEqual(["summary", "page:5:c", `commit:${HEAD_SHA}`, "contributors"]);
	});

	it("passes on the 404 for a repository outside the list", async () => {
		await expect(new GithubContributionsApplicationService(new FakeContributions()).repositorySummary({ owner: "someone", repository: "secret" })).rejects.toBeInstanceOf(
			GithubRepositoryNotConfiguredError,
		);
	});
});

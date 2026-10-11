import { Logger } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { createTestTypedConfig, type TestEnv } from "../../../test/support/test-api-env";
import { GithubRepositoryNotConfiguredError, GithubUnavailableError } from "./github.errors";
import { GithubApiClient } from "./github-api.client";
import { TypedConfigService } from "../../config/typed-config.service";
import { GITHUB_CLOCK, GithubContributionsService } from "./github-contributions.service";
import { commitHistory, contributorStat, repositoryNode, summaryNode, viewerRepositories } from "./__tests__/github-wire.builders";

const CACHE_TTL_MS = 60_000;
const START = 1_800_000_000_000;

interface FakeGithubApiClient {
	readonly fetchRepositorySummary: Mock<GithubApiClient["fetchRepositorySummary"]>;
	readonly fetchCommitHistory: Mock<GithubApiClient["fetchCommitHistory"]>;
	readonly fetchContributorStats: Mock<GithubApiClient["fetchContributorStats"]>;
	readonly fetchViewerRepositories: Mock<GithubApiClient["fetchViewerRepositories"]>;
}

interface TestClock {
	now: number;
	nowEpochMs(): number;
}

interface Harness {
	readonly service: GithubContributionsService;
	readonly client: FakeGithubApiClient;
	readonly clock: TestClock;
}

const TOKEN = "github_pat_test_read_only";
/** Two pinned repositories. */
const CONFIGURED: TestEnv = { GITHUB_TOKEN: TOKEN, GITHUB_REPOSITORIES: "octo-org/hello-world,Octo-Org/Website" };
/** A token and no pinned repositories: the list is discovered from the token's account. */
const DISCOVERED: TestEnv = { GITHUB_TOKEN: TOKEN };
/** No token: the integration is off. */
const OFF: TestEnv = {};

async function setup(github: TestEnv = CONFIGURED): Promise<Harness> {
	const config = createTestTypedConfig({ ...github, GITHUB_CACHE_TTL_MS: String(CACHE_TTL_MS) });
	const client: FakeGithubApiClient = {
		fetchRepositorySummary: vi.fn<GithubApiClient["fetchRepositorySummary"]>(() => Promise.resolve(summaryNode())),
		fetchCommitHistory: vi.fn<GithubApiClient["fetchCommitHistory"]>(() => Promise.resolve(commitHistory())),
		fetchContributorStats: vi.fn<GithubApiClient["fetchContributorStats"]>(() => Promise.resolve({ status: "ready", stats: [contributorStat("amy", [[1, 1, 1]])] })),
		fetchViewerRepositories: vi.fn<GithubApiClient["fetchViewerRepositories"]>(() =>
			Promise.resolve(viewerRepositories([repositoryNode("patelzz007/Site", "2026-10-01T00:00:00Z")], [repositoryNode("vercel/next.js", "2026-09-01T00:00:00Z")])),
		),
	};
	const clock: TestClock = { now: START, nowEpochMs: (): number => clock.now };
	const moduleRef = await Test.createTestingModule({
		providers: [
			GithubContributionsService,
			{ provide: TypedConfigService, useValue: config },
			{ provide: GithubApiClient, useValue: client },
			{ provide: GITHUB_CLOCK, useValue: clock },
		],
	}).compile();
	return { service: moduleRef.get(GithubContributionsService), client, clock };
}

describe("GithubContributionsService", () => {
	beforeEach(() => {
		vi.spyOn(Logger.prototype, "warn").mockImplementation((): void => undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("listRepositories", () => {
		it("lists the pinned repositories in the configured order, without asking GitHub", async () => {
			const { service, client } = await setup();

			expect(await service.listRepositories()).toMatchObject({
				source: "configured",
				repositories: [{ fullName: "octo-org/hello-world" }, { fullName: "Octo-Org/Website" }],
			});
			expect(client.fetchViewerRepositories).not.toHaveBeenCalled();
		});

		it("is an empty `off` list without a token", async () => {
			expect(await (await setup(OFF)).service.listRepositories()).toEqual({ source: "off", account: null, repositories: [] });
		});

		it("discovers the token account's repositories when none are pinned, and reuses them while fresh", async () => {
			const { service, client } = await setup(DISCOVERED);

			expect(await service.listRepositories()).toMatchObject({
				source: "discovered",
				account: "patelzz007",
				repositories: [
					{ fullName: "patelzz007/Site", relationship: "owned" },
					{ fullName: "vercel/next.js", relationship: "contributed" },
				],
			});
			await service.listRepositories();
			expect(client.fetchViewerRepositories).toHaveBeenCalledTimes(1);
		});

		it("serves the last discovered list while GitHub is unavailable", async () => {
			const { service, client, clock } = await setup(DISCOVERED);

			await service.listRepositories();
			clock.now += CACHE_TTL_MS;
			client.fetchViewerRepositories.mockRejectedValueOnce(new GithubUnavailableError("timeout"));

			expect((await service.listRepositories()).repositories).toHaveLength(2);
		});
	});

	describe("the repository allowlist", () => {
		it("allows a discovered repository, read with GitHub's spelling", async () => {
			const { service, client } = await setup(DISCOVERED);

			await service.getRepositorySummary({ owner: "patelzz007", repository: "site" });

			expect(client.fetchRepositorySummary).toHaveBeenCalledWith({ owner: "patelzz007", repository: "Site" });
		});

		it("refuses a repository the token's account neither owns nor contributed to", async () => {
			const { service, client } = await setup(DISCOVERED);

			await expect(service.getCommitPage({ owner: "patelzz007", repository: "private-thing" }, { limit: 20 })).rejects.toBeInstanceOf(GithubRepositoryNotConfiguredError);
			expect(client.fetchCommitHistory).not.toHaveBeenCalled();
		});

		it("fails a read when the list cannot be discovered", async () => {
			const { service, client } = await setup(DISCOVERED);
			client.fetchViewerRepositories.mockRejectedValueOnce(new GithubUnavailableError("unreachable"));

			await expect(service.getRepositorySummary({ owner: "patelzz007", repository: "Site" })).rejects.toBeInstanceOf(GithubUnavailableError);
			expect(client.fetchRepositorySummary).not.toHaveBeenCalled();
		});

		it.each([
			["a repository that is not configured", { owner: "octo-org", repository: "secret" }],
			["another owner's repository of the same name", { owner: "someone", repository: "hello-world" }],
		])("refuses %s with a 404 before asking GitHub", async (_label: string, requested: { owner: string; repository: string }) => {
			const { service, client } = await setup();

			await expect(service.getRepositorySummary(requested)).rejects.toBeInstanceOf(GithubRepositoryNotConfiguredError);
			await expect(service.getCommitPage(requested, { limit: 20 })).rejects.toBeInstanceOf(GithubRepositoryNotConfiguredError);
			await expect(service.getContributorStats(requested)).rejects.toBeInstanceOf(GithubRepositoryNotConfiguredError);
			expect(client.fetchRepositorySummary).not.toHaveBeenCalled();
			expect(client.fetchCommitHistory).not.toHaveBeenCalled();
			expect(client.fetchContributorStats).not.toHaveBeenCalled();
		});

		it("refuses everything when the integration is off", async () => {
			await expect((await setup(OFF)).service.getRepositorySummary({ owner: "octo-org", repository: "hello-world" })).rejects.toBeInstanceOf(
				GithubRepositoryNotConfiguredError,
			);
		});

		it("matches case-insensitively and reads GitHub with the configured spelling", async () => {
			const { service, client } = await setup();

			const summary = await service.getRepositorySummary({ owner: "octo-org", repository: "website" });

			expect(client.fetchRepositorySummary).toHaveBeenCalledWith({ owner: "Octo-Org", repository: "Website" });
			expect(summary.fullName).toBe("Octo-Org/Website");
		});
	});

	describe("getRepositorySummary", () => {
		it("maps GitHub's answer and reuses it while fresh", async () => {
			const { service, client, clock } = await setup();
			const repository = { owner: "octo-org", repository: "hello-world" };

			expect(await service.getRepositorySummary(repository)).toMatchObject({ fullName: "octo-org/hello-world", stars: 42, totalCommits: 128 });
			clock.now += CACHE_TTL_MS - 1;
			await service.getRepositorySummary(repository);

			expect(client.fetchRepositorySummary).toHaveBeenCalledTimes(1);
		});

		it("serves the last good answer while GitHub is unavailable", async () => {
			const { service, client, clock } = await setup();
			const repository = { owner: "octo-org", repository: "hello-world" };

			await service.getRepositorySummary(repository);
			clock.now += CACHE_TTL_MS;
			client.fetchRepositorySummary.mockRejectedValueOnce(new GithubUnavailableError("timeout"));

			expect(await service.getRepositorySummary(repository)).toMatchObject({ stars: 42 });
		});

		it("fails when GitHub is unavailable and nothing was read before", async () => {
			const { service, client } = await setup();
			client.fetchRepositorySummary.mockRejectedValueOnce(new GithubUnavailableError("timeout"));

			await expect(service.getRepositorySummary({ owner: "octo-org", repository: "hello-world" })).rejects.toBeInstanceOf(GithubUnavailableError);
		});
	});

	describe("getCommitPage", () => {
		it("asks GitHub for the requested page and caches each page on its own", async () => {
			const { service, client } = await setup();
			const repository = { owner: "octo-org", repository: "hello-world" };

			const first = await service.getCommitPage(repository, { limit: 20 });
			await service.getCommitPage(repository, { limit: 20, cursor: "cursor-1" });
			await service.getCommitPage(repository, { limit: 20 });

			expect(first.items).toHaveLength(2);
			expect(client.fetchCommitHistory.mock.calls).toEqual([
				[
					{ owner: "octo-org", repository: "hello-world" },
					{ first: 20, after: null },
				],
				[
					{ owner: "octo-org", repository: "hello-world" },
					{ first: 20, after: "cursor-1" },
				],
			]);
		});

		it("keeps different page sizes apart", async () => {
			const { service, client } = await setup();
			const repository = { owner: "octo-org", repository: "hello-world" };

			await service.getCommitPage(repository, { limit: 20 });
			await service.getCommitPage(repository, { limit: 5 });

			expect(client.fetchCommitHistory).toHaveBeenCalledTimes(2);
		});
	});

	describe("getContributorStats", () => {
		it("returns ready statistics and reuses them while fresh", async () => {
			const { service, client } = await setup();
			const repository = { owner: "octo-org", repository: "hello-world" };

			expect(await service.getContributorStats(repository)).toMatchObject({ status: "ready", contributors: [{ login: "amy" }] });
			await service.getContributorStats(repository);

			expect(client.fetchContributorStats).toHaveBeenCalledTimes(1);
		});

		it("asks again on the next read while GitHub is still computing", async () => {
			const { service, client } = await setup();
			const repository = { owner: "octo-org", repository: "hello-world" };
			client.fetchContributorStats.mockResolvedValueOnce({ status: "computing" });

			expect(await service.getContributorStats(repository)).toEqual({ status: "computing" });
			expect(await service.getContributorStats(repository)).toMatchObject({ status: "ready" });
			expect(client.fetchContributorStats).toHaveBeenCalledTimes(2);
		});
	});
});

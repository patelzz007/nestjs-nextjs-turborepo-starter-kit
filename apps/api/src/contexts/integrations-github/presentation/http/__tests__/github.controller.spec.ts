import { PATH_METADATA } from "@nestjs/common/constants";
import { Reflector } from "@nestjs/core";
import { CqrsModule } from "@nestjs/cqrs";
import { Test } from "@nestjs/testing";
import { API_VERSION_PREFIX } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { RequirePermission } from "../../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { ResponseContract } from "../../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { GITHUB_CONTRIBUTIONS } from "../../../application/ports/github.tokens";
import { GetGithubCommitHandler } from "../../../application/queries/get-github-commit/get-github-commit.handler";
import { GetGithubCommitPageHandler } from "../../../application/queries/get-github-commit-page/get-github-commit-page.handler";
import { GetGithubContributorStatsHandler } from "../../../application/queries/get-github-contributor-stats/get-github-contributor-stats.handler";
import { GetGithubRepositorySummaryHandler } from "../../../application/queries/get-github-repository-summary/get-github-repository-summary.handler";
import { ListGithubRepositoriesHandler } from "../../../application/queries/list-github-repositories/list-github-repositories.handler";
import { FakeContributions, SUMMARY } from "../../../application/__tests__/fakes/github-contributions.fake";
import { HEAD_SHA, REPOSITORY, userActor } from "../../../application/__tests__/fakes/github-contract.fixtures";
import { GithubController } from "../github.controller";
import { handlerOf } from "./route-metadata";

const reflector = new Reflector();
const REQUIRED_PERMISSION_KEY = RequirePermission("READ", "GITHUB").KEY;

type HandlerName = "listRepositories" | "getRepositorySummary" | "getCommitPage" | "getCommit" | "getContributorStats";

const HANDLERS: readonly HandlerName[] = ["listRepositories", "getRepositorySummary", "getCommitPage", "getCommit", "getContributorStats"];

describe("GithubController", () => {
	it("is served under the versioned /github/repositories prefix", () => {
		expect(reflector.get<string>(PATH_METADATA, GithubController)).toBe(`${API_VERSION_PREFIX}/github/repositories`);
	});

	it.each(HANDLERS)("requires READ GITHUB for %s, with one response contract", (name: HandlerName) => {
		const handler = handlerOf(GithubController.prototype, name);
		expect(reflector.get<object>(REQUIRED_PERMISSION_KEY, handler)).toEqual({ action: "READ", resource: "GITHUB" });
		expect(reflector.get(ResponseContract, handler)).toBeDefined();
	});

	it.each<[HandlerName, string]>([
		["listRepositories", "/"],
		["getRepositorySummary", ":owner/:repository"],
		["getCommitPage", ":owner/:repository/commits"],
		["getCommit", ":owner/:repository/commits/:sha"],
		["getContributorStats", ":owner/:repository/contributors"],
	])("routes %s to %j", (name: HandlerName, path: string) => {
		expect(reflector.get<string>(PATH_METADATA, handlerOf(GithubController.prototype, name))).toBe(path);
	});

	it("dispatches one query per route, with the caller and the validated input, and answers what the query answered", async () => {
		const contributions = new FakeContributions();
		const moduleRef = await Test.createTestingModule({
			imports: [CqrsModule.forRoot()],
			controllers: [GithubController],
			providers: [
				ListGithubRepositoriesHandler,
				GetGithubRepositorySummaryHandler,
				GetGithubCommitPageHandler,
				GetGithubCommitHandler,
				GetGithubContributorStatsHandler,
				{ provide: GITHUB_CONTRIBUTIONS, useValue: contributions },
			],
		}).compile();
		await moduleRef.init();
		const controller = moduleRef.get(GithubController);

		await expect(controller.listRepositories(userActor())).resolves.toEqual({ source: "off", account: null, repositories: [] });
		await expect(controller.getRepositorySummary(userActor(), REPOSITORY)).resolves.toBe(SUMMARY);
		await expect(controller.getCommitPage(userActor(), REPOSITORY, { limit: 5, cursor: "c" })).resolves.toMatchObject({ items: [] });
		await expect(controller.getCommit(userActor(), { ...REPOSITORY, sha: HEAD_SHA })).resolves.toMatchObject({ sha: HEAD_SHA });
		await expect(controller.getContributorStats(userActor(), REPOSITORY)).resolves.toMatchObject({ status: "ready" });
		expect(contributions.asked).toEqual(["list", "summary", "page:5:c", `commit:${HEAD_SHA}`, "contributors"]);
	});
});

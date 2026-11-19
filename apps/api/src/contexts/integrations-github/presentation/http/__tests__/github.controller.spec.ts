import { PATH_METADATA } from "@nestjs/common/constants";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { API_VERSION_PREFIX } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { REQUIRED_PERMISSION_KEY } from "../../../../../platform/presentation/http/security/decorators/route-requirements.metadata";
import { ResponseContract } from "../../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { GITHUB_CONTRIBUTIONS } from "../../../application/ports/github.tokens";
import { GithubContributionsApplicationService } from "../../../application/services/github-contributions.application-service";
import { FakeContributions, SUMMARY } from "../../../application/__tests__/fakes/github-contributions.fake";
import { HEAD_SHA, REPOSITORY } from "../../../application/__tests__/fakes/github-contract.fixtures";
import { GithubController } from "../github.controller";
import { servedPathOf } from "../../../../../../e2e/support/route-metadata";
import { handlerOf } from "./route-metadata";

const reflector = new Reflector();

type HandlerName = "listRepositories" | "getRepositorySummary" | "getCommitPage" | "getCommit" | "getContributorStats";

const HANDLERS: readonly HandlerName[] = ["listRepositories", "getRepositorySummary", "getCommitPage", "getCommit", "getContributorStats"];

describe("GithubController", () => {
	it("is served under the versioned /github/repositories prefix", () => {
		expect(servedPathOf(GithubController)).toBe(`${API_VERSION_PREFIX}/github/repositories`);
	});

	it.each(HANDLERS)("requires READ GITHUB for %s, with one response contract", (name: HandlerName) => {
		const handler = handlerOf(GithubController.prototype, name);
		expect(reflector.get<readonly object[]>(REQUIRED_PERMISSION_KEY, handler)).toEqual([{ action: "READ", resource: "GITHUB" }]);
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

	it("answers each route from the contributions service, with the validated input", async () => {
		const contributions = new FakeContributions();
		const moduleRef = await Test.createTestingModule({
			controllers: [GithubController],
			providers: [GithubContributionsApplicationService, { provide: GITHUB_CONTRIBUTIONS, useValue: contributions }],
		}).compile();
		await moduleRef.init();
		const controller = moduleRef.get(GithubController);

		await expect(controller.listRepositories()).resolves.toEqual({ source: "off", account: null, repositories: [] });
		await expect(controller.getRepositorySummary(REPOSITORY)).resolves.toBe(SUMMARY);
		await expect(controller.getCommitPage(REPOSITORY, { limit: 5, cursor: "c" })).resolves.toMatchObject({ items: [] });
		await expect(controller.getCommit({ ...REPOSITORY, sha: HEAD_SHA })).resolves.toMatchObject({ sha: HEAD_SHA });
		await expect(controller.getContributorStats(REPOSITORY)).resolves.toMatchObject({ status: "ready" });
		expect(contributions.asked).toEqual(["list", "summary", "page:5:c", `commit:${HEAD_SHA}`, "contributors"]);
	});
});

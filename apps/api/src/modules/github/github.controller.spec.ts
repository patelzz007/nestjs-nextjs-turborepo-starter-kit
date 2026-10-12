import { PATH_METADATA } from "@nestjs/common/constants";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { API_VERSION_PREFIX, type GithubCommitDetail, type GithubCommitPage, type GithubContributorStats, type GithubRepositorySummary } from "@workspace/shared";
import { describe, expect, it, vi } from "vitest";

import { REQUIRED_PERMISSION_KEY } from "../authorization/constants/authorization.constants";
import { GithubContributionsService } from "./github-contributions.service";
import { GithubController } from "./github.controller";
import { GITHUB_INTEGRATION_OFF, toCommitDetail, toRepositorySummary } from "./github.mappers";
import { SHA_A, commitDetailWire, summaryNode } from "./__tests__/github-wire.builders";

const reflector = new Reflector();

type HandlerName = "listRepositories" | "getRepositorySummary" | "getCommitPage" | "getCommit" | "getContributorStats";

const HANDLERS: readonly HandlerName[] = ["listRepositories", "getRepositorySummary", "getCommitPage", "getCommit", "getContributorStats"];
const REPOSITORY = { owner: "octo-org", repository: "hello-world" };

function routeMetadata(name: HandlerName, key: string): object | string | undefined {
	const descriptor: TypedPropertyDescriptor<GithubController[HandlerName]> | undefined = Object.getOwnPropertyDescriptor(GithubController.prototype, name);
	const handler: GithubController[HandlerName] | undefined = descriptor?.value;
	if (handler === undefined) {
		throw new Error(`GithubController.${name} is not a method`);
	}
	return reflector.get<object | string | undefined>(key, handler);
}

describe("GithubController", () => {
	it("is served under the versioned /github/repositories prefix", () => {
		expect(reflector.get<string>(PATH_METADATA, GithubController)).toBe(`${API_VERSION_PREFIX}/github/repositories`);
	});

	it.each(HANDLERS)("requires READ GITHUB for %s", (name: HandlerName) => {
		expect(routeMetadata(name, REQUIRED_PERMISSION_KEY)).toEqual({ action: "READ", resource: "GITHUB" });
	});

	it.each([
		["listRepositories", ""],
		["getRepositorySummary", ":owner/:repository"],
		["getCommitPage", ":owner/:repository/commits"],
		["getCommit", ":owner/:repository/commits/:sha"],
		["getContributorStats", ":owner/:repository/contributors"],
	])("routes %s to %j", (name: string, path: string) => {
		const handler = HANDLERS.find((candidate: HandlerName): boolean => candidate === name);
		if (handler === undefined) {
			throw new Error(`unknown handler ${name}`);
		}
		expect(routeMetadata(handler, PATH_METADATA)).toBe(path === "" ? "/" : path);
	});

	it("delegates every route to the service with the validated input", async () => {
		const summary: GithubRepositorySummary = toRepositorySummary(REPOSITORY, summaryNode());
		const page: GithubCommitPage = { items: [], nextCursor: null, totalCommits: 0 };
		const stats: GithubContributorStats = { status: "computing" };
		const commit: GithubCommitDetail = toCommitDetail({ commit: commitDetailWire(), filesTruncated: false });
		const service = {
			listRepositories: vi.fn<GithubContributionsService["listRepositories"]>(() => Promise.resolve(GITHUB_INTEGRATION_OFF)),
			getRepositorySummary: vi.fn<GithubContributionsService["getRepositorySummary"]>(() => Promise.resolve(summary)),
			getCommitPage: vi.fn<GithubContributionsService["getCommitPage"]>(() => Promise.resolve(page)),
			getCommit: vi.fn<GithubContributionsService["getCommit"]>(() => Promise.resolve(commit)),
			getContributorStats: vi.fn<GithubContributionsService["getContributorStats"]>(() => Promise.resolve(stats)),
		};
		const moduleRef = await Test.createTestingModule({ controllers: [GithubController], providers: [{ provide: GithubContributionsService, useValue: service }] }).compile();
		const controller = moduleRef.get(GithubController);

		expect(await controller.listRepositories()).toBe(GITHUB_INTEGRATION_OFF);
		expect(await controller.getRepositorySummary(REPOSITORY)).toBe(summary);
		expect(await controller.getCommitPage(REPOSITORY, { limit: 5, cursor: "c" })).toBe(page);
		expect(await controller.getContributorStats(REPOSITORY)).toBe(stats);
		expect(await controller.getCommit({ ...REPOSITORY, sha: SHA_A })).toBe(commit);
		expect(service.getCommit).toHaveBeenCalledWith({ ...REPOSITORY, sha: SHA_A });
		expect(service.getRepositorySummary).toHaveBeenCalledWith(REPOSITORY);
		expect(service.getContributorStats).toHaveBeenCalledWith(REPOSITORY);
		expect(service.getCommitPage).toHaveBeenCalledWith(REPOSITORY, { limit: 5, cursor: "c" });
	});
});

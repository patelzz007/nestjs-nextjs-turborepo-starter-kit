import { NotFoundException, UnauthorizedException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";

import { accessToken, createHttpContext, testRequest } from "../../../../test/support/http-execution-context";
import { GithubLiveUpdatesService } from "./github-live-updates.service";
import { GithubRepositoryVisibleGuard } from "./github-repository-visible.guard";

async function guardWith(assertCanStream: GithubLiveUpdatesService["assertCanStream"]): Promise<GithubRepositoryVisibleGuard> {
	const moduleRef = await Test.createTestingModule({
		providers: [GithubRepositoryVisibleGuard, { provide: GithubLiveUpdatesService, useValue: { assertCanStream } }],
	}).compile();
	return moduleRef.get(GithubRepositoryVisibleGuard);
}

describe("GithubRepositoryVisibleGuard", () => {
	it("lets the stream open when the caller's token can see the repository", async () => {
		const assertCanStream = vi.fn<GithubLiveUpdatesService["assertCanStream"]>(() => Promise.resolve());
		const guard = await guardWith(assertCanStream);

		await expect(guard.canActivate(createHttpContext(testRequest({ user: accessToken(), params: { owner: "octo-org", repository: "hello-world" } })))).resolves.toBe(true);
		expect(assertCanStream).toHaveBeenCalledWith("user-1", { owner: "octo-org", repository: "hello-world" });
	});

	it("answers 404 before any stream for a repository it cannot see, or an address that names none", async () => {
		const guard = await guardWith(() => Promise.reject(new NotFoundException()));

		await expect(guard.canActivate(createHttpContext(testRequest({ user: accessToken(), params: { owner: "octo-org", repository: "hello-world" } })))).rejects.toBeInstanceOf(
			NotFoundException,
		);
		await expect(guard.canActivate(createHttpContext(testRequest({ user: accessToken(), params: { owner: "-bad-", repository: "x" } })))).rejects.toBeInstanceOf(
			NotFoundException,
		);
	});

	it("refuses a request without a signed-in user", async () => {
		const guard = await guardWith(() => Promise.resolve());

		await expect(guard.canActivate(createHttpContext(testRequest({ params: { owner: "octo-org", repository: "hello-world" } })))).rejects.toBeInstanceOf(
			UnauthorizedException,
		);
	});
});

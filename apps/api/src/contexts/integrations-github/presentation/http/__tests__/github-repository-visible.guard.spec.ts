import { NotFoundException, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { CqrsModule, QueryBus } from "@nestjs/cqrs";
import { Test } from "@nestjs/testing";
import type { FastifyRequest } from "fastify";
import { describe, expect, it } from "vitest";

import { accessToken, createHttpContext, testRequest } from "../../../../../../test/support/http-execution-context";
import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { ActorContextFactory } from "../../../../../platform/presentation/http/security/actor-context.factory";
import { GITHUB_WEBHOOK_ENDPOINT, GITHUB_WEBHOOKS } from "../../../application/ports/github.tokens";
import { GithubLinkedCredentials } from "../../../application/services/github-linked-credentials";
import { CheckLiveUpdatesStreamHandler } from "../../../application/queries/check-live-updates-stream/check-live-updates-stream.handler";
import { userActor } from "../../../application/__tests__/fakes/github-contract.fixtures";
import { githubHarness, linkToken, type GithubHarness } from "../../../application/__tests__/fakes/github-harness";
import { GithubRepositoryVisibleGuard } from "../github-repository-visible.guard";

/** Resolves the signed-in user's actor the way `@CurrentActor()` would, recording each request it was asked for. */
class SignedInActors implements Pick<ActorContextFactory, "fromHttpRequest"> {
	public readonly asked: FastifyRequest[] = [];

	public fromHttpRequest(request: FastifyRequest): ActorContext {
		this.asked.push(request);
		return userActor();
	}
}

async function guardWith(harness: GithubHarness): Promise<{ readonly guard: GithubRepositoryVisibleGuard; readonly actors: SignedInActors }> {
	const moduleRef = await Test.createTestingModule({
		imports: [CqrsModule.forRoot()],
		providers: [
			CheckLiveUpdatesStreamHandler,
			{ provide: GithubLinkedCredentials, useValue: harness.credentials },
			{ provide: GITHUB_WEBHOOK_ENDPOINT, useValue: harness.endpoint },
			{ provide: GITHUB_WEBHOOKS, useValue: harness.webhooks },
		],
	}).compile();
	await moduleRef.init();
	const actors = new SignedInActors();
	return { guard: new GithubRepositoryVisibleGuard(moduleRef.get(QueryBus), actors), actors };
}

const VISIBLE = { owner: "octo-org", repository: "hello-world" };

describe("GithubRepositoryVisibleGuard", () => {
	it("lets the stream open when the caller's own token can see the repository", async () => {
		const harness = githubHarness();
		await linkToken(harness);
		const { guard, actors } = await guardWith(harness);

		await expect(guard.canActivate(createHttpContext(testRequest({ user: accessToken(), params: VISIBLE })))).resolves.toBe(true);
		expect(actors.asked).toHaveLength(1);
	});

	it("answers 404 before any stream for a repository the token cannot see, or an address that names none", async () => {
		const harness = githubHarness();
		await linkToken(harness);
		harness.webhooks.visible = false;
		const { guard, actors } = await guardWith(harness);

		await expect(guard.canActivate(createHttpContext(testRequest({ user: accessToken(), params: VISIBLE })))).rejects.toBeInstanceOf(NotFoundException);
		await expect(guard.canActivate(createHttpContext(testRequest({ user: accessToken(), params: { owner: "-bad-", repository: "x" } })))).rejects.toBeInstanceOf(
			NotFoundException,
		);
		expect(actors.asked).toHaveLength(1);
	});

	it("answers 503 when this server receives no webhooks", async () => {
		const harness = githubHarness();
		harness.endpoint.settings = null;
		const { guard } = await guardWith(harness);

		await expect(guard.canActivate(createHttpContext(testRequest({ user: accessToken(), params: VISIBLE })))).rejects.toBeInstanceOf(ServiceUnavailableException);
	});

	it("refuses a request without a signed-in user", async () => {
		const { guard, actors } = await guardWith(githubHarness());

		await expect(guard.canActivate(createHttpContext(testRequest({ params: VISIBLE })))).rejects.toBeInstanceOf(UnauthorizedException);
		expect(actors.asked).toEqual([]);
	});
});

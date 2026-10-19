import { Inject, Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { QueryBus } from "@nestjs/cqrs";
import { GithubLiveUpdatesParamsSchema } from "@workspace/shared";
import type { FastifyRequest } from "fastify";

import { ActorContextFactory } from "../../../../platform/presentation/http/security/actor-context.factory";
import { githubRepositoryNotVisible } from "../../application/errors/github.errors";
import { CheckLiveUpdatesStreamQuery } from "../../application/queries/check-live-updates-stream/check-live-updates-stream.query";

/**
 * Opens a repository's change stream only for someone whose own GitHub token
 * can see the repository (ADR 052) — checked before the stream exists, so a
 * refusal is an ordinary 404 (GitHub's own answer for a repository it does not
 * show), never a stream that fails half-way. Runs after authentication and the
 * GITHUB_PULL_REQUEST permission check (the global guards).
 */
@Injectable()
export class GithubRepositoryVisibleGuard implements CanActivate {
	public constructor(
		@Inject(QueryBus) private readonly queryBus: Pick<QueryBus, "execute">,
		@Inject(ActorContextFactory) private readonly actors: Pick<ActorContextFactory, "fromHttpRequest">,
	) {}

	public async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<FastifyRequest>();
		if (request.user?.sub === undefined) {
			throw new UnauthorizedException();
		}
		const params = GithubLiveUpdatesParamsSchema.safeParse(request.params);
		if (!params.success) {
			throw githubRepositoryNotVisible();
		}
		await this.queryBus.execute(new CheckLiveUpdatesStreamQuery(this.actors.fromHttpRequest(request), params.data));
		return true;
	}
}

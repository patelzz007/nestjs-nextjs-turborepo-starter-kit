import { Injectable, NotFoundException, UnauthorizedException, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { GithubLiveUpdatesParamsSchema } from "@workspace/shared";
import type { FastifyRequest } from "fastify";

import { GithubLiveUpdatesService } from "./github-live-updates.service";

/**
 * Opens a repository's change stream only for someone whose own GitHub token
 * can see the repository (ADR 052) — checked before the stream exists, so a
 * refusal is an ordinary 404 (GitHub's own answer for a repository it does not
 * show), never a stream that fails half-way. Runs after authentication and the
 * GITHUB_PULL_REQUEST permission check (the global guards).
 */
@Injectable()
export class GithubRepositoryVisibleGuard implements CanActivate {
	public constructor(private readonly liveUpdates: GithubLiveUpdatesService) {}

	public async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<FastifyRequest>();
		const userId = request.user?.sub;
		if (userId === undefined) {
			throw new UnauthorizedException();
		}
		const params = GithubLiveUpdatesParamsSchema.safeParse(request.params);
		if (!params.success) {
			throw new NotFoundException({ message: "This repository could not be found on GitHub, or your GitHub token cannot see it." });
		}
		await this.liveUpdates.assertCanStream(userId, params.data);
		return true;
	}
}

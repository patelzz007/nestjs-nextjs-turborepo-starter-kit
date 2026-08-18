import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { createHash, timingSafeEqual } from "node:crypto";

import type { TelescopeOptions } from "@workspace/shared";

import { TELESCOPE_OPTIONS } from "./telescope.options";

/**
 * Defense-in-depth admin gate for `/telescope/*` (docs/telescope.md §10.7).
 * The global `AuthGuard` already proves the caller is authenticated (JWT **or**
 * `TELESCOPE_TOKEN` Bearer). This guard additionally requires `hasAdminAccess`
 * — Telescope exposes request bodies, SQL and user ids, so it must never be
 * reachable by a plain user.
 *
 * Improvement 12: when `TELESCOPE_TOKEN` is configured, the same endpoints
 * accept `Authorization: Bearer <token>` — that lets CI / the CLI script
 * read Telescope data without a user session. The comparison is constant-time
 * (hashed + `timingSafeEqual`) so a token leak via timing is not a thing.
 */
@Injectable()
export class TelescopeAdminGuard implements CanActivate {
	public constructor(@Inject(TELESCOPE_OPTIONS) private readonly options: TelescopeOptions) {}

	public canActivate(context: ExecutionContext): boolean {
		const request: FastifyRequest = context.switchToHttp().getRequest<FastifyRequest>();

		// Fail-closed: when Telescope is disabled (production default), the
		// routes behave as if they never existed — 404 instead of leaking an
		// empty dashboard or exercising the capture surfaces.
		if (!this.options.enabled) {
			throw new NotFoundException();
		}

		const token: string | undefined = this.options.token;
		if (token !== undefined && request.headers.authorization?.startsWith("Bearer ") === true) {
			const presented: string = request.headers.authorization.slice("Bearer ".length);
			if (this.secureEquals(presented, token)) {
				return true;
			}
		}

		const user = request.user;
		// Narrow the access/refresh payload union: only access tokens carry
		// `hasAdminAccess`, and the guard requires it to be true.
		if (user === undefined || !("hasAdminAccess" in user) || !user.hasAdminAccess) {
			throw new ForbiddenException({ message: "Admin access required to view Telescope data.", error: "ADMIN_ACCESS_REQUIRED" });
		}
		return true;
	}

	private secureEquals(a: string, b: string): boolean {
		const hashA: Buffer = createHash("sha256").update(a).digest();
		const hashB: Buffer = createHash("sha256").update(b).digest();
		return timingSafeEqual(hashA, hashB);
	}
}

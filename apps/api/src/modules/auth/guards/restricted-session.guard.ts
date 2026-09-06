import { CanActivate, type ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";

import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import type { AccessTokenPayload } from "../services/token.service";

/** Metadata key for routes that explicitly require a full (non-restricted) session. */
export const REQUIRES_FULL_SESSION_KEY = "requiresFullSession";

/** Metadata key for routes that remain accessible on a restricted enrollment session. */
export const ALLOW_RESTRICTED_SESSION_KEY = "allowRestrictedSession";

type RestrictedRouteRule = {
	readonly method: string;
	readonly pathSuffix: string;
};

/**
 * Routes accessible while `sessionScope === "restricted"`.
 * Matches suffixes so versioned prefixes (`/api/v1/...`) are handled.
 */
const RESTRICTED_SESSION_ALLOWLIST: readonly RestrictedRouteRule[] = [
	{ method: "GET", pathSuffix: "/auth/me" },
	{ method: "GET", pathSuffix: "/auth/permissions" },
	{ method: "GET", pathSuffix: "/session" },
	{ method: "POST", pathSuffix: "/auth/logout" },
	{ method: "POST", pathSuffix: "/auth/logout-all" },
	{ method: "GET", pathSuffix: "/auth/2fa/setup" },
	{ method: "POST", pathSuffix: "/auth/2fa/enable" },
	{ method: "POST", pathSuffix: "/auth/resend-verification" },
	{ method: "POST", pathSuffix: "/auth/verify-email" },
	{ method: "POST", pathSuffix: "/auth/mfa/recovery" },
	{ method: "GET", pathSuffix: "/auth/mfa/recovery/status" },
];

/**
 * Blocks restricted enrollment sessions from privileged routes.
 *
 * Restricted tokens may only reach the built-in allowlist (logout, profile,
 * email verification, MFA enrollment). Apply `@RequiresFullSession()` on
 * handlers that must reject restricted tokens even when not on the allowlist.
 */
@Injectable()
export class RestrictedSessionGuard implements CanActivate {
	public constructor(private readonly reflector: Reflector) {}

	public canActivate(context: ExecutionContext): boolean {
		const isPublic: boolean = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
		if (isPublic) {
			return true;
		}

		const allowRestricted: boolean = this.reflector.getAllAndOverride<boolean>(ALLOW_RESTRICTED_SESSION_KEY, [context.getHandler(), context.getClass()]);
		if (allowRestricted) {
			return true;
		}

		const request: FastifyRequest = context.switchToHttp().getRequest<FastifyRequest>();
		const user = request.user;

		if (user === undefined || !("sessionScope" in user) || !("hasAdminAccess" in user)) {
			return true;
		}

		const accessUser: AccessTokenPayload = user;

		if (accessUser.sessionScope !== "restricted") {
			return true;
		}

		if (this.isAllowlistedRoute(request)) {
			return true;
		}

		throw new ForbiddenException({
			message: "Complete email verification and MFA enrollment to access this resource.",
			error: "RESTRICTED_SESSION",
		});
	}

	private isAllowlistedRoute(request: FastifyRequest): boolean {
		const method: string = request.method.toUpperCase();
		const path: string = request.url.split("?")[0] ?? request.url;

		return RESTRICTED_SESSION_ALLOWLIST.some((rule: RestrictedRouteRule): boolean => method === rule.method && path.endsWith(rule.pathSuffix));
	}
}

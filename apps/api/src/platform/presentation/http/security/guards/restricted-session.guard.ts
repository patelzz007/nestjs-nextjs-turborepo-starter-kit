import { CanActivate, type ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";

import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { routeTemplateOf } from "../../routed-path";
import type { AccessTokenPayload } from "@workspace/shared";

/** Metadata key for routes that explicitly require a full (non-restricted) session. */
export const REQUIRES_FULL_SESSION_KEY = "requiresFullSession";

/** Metadata key for routes that remain accessible on a restricted enrollment session. */
export const ALLOW_RESTRICTED_SESSION_KEY = "allowRestrictedSession";

interface RestrictedRouteRule {
	readonly method: string;
	readonly pathSuffix: string;
}

/**
 * Routes accessible while `sessionScope === "restricted"`.
 * Matched against the route TEMPLATE Fastify dispatched to (never the raw `request.url`, whose query or
 * `#` fragment the caller controls), by suffix so versioned prefixes (`/api/v1/...`) are handled.
 */
const RESTRICTED_SESSION_ALLOWLIST: readonly RestrictedRouteRule[] = [
	{ method: "GET", pathSuffix: "/auth/me" },
	{ method: "GET", pathSuffix: "/auth/permissions" },
	{ method: "GET", pathSuffix: "/session" },
	{ method: "POST", pathSuffix: "/auth/logout" },
	{ method: "POST", pathSuffix: "/auth/logout-all" },
	{ method: "POST", pathSuffix: "/auth/2fa/setup" },
	{ method: "GET", pathSuffix: "/auth/2fa/backup-codes/remaining" },
	{ method: "POST", pathSuffix: "/auth/2fa/enable" },
	{ method: "POST", pathSuffix: "/auth/resend-verification" },
	{ method: "POST", pathSuffix: "/auth/verify-email" },
	{ method: "GET", pathSuffix: "/merchant/me" },
	{ method: "GET", pathSuffix: "/tenants/memberships" },
	{ method: "GET", pathSuffix: "/merchant/kyb" },
	{ method: "PATCH", pathSuffix: "/merchant/kyb" },
	{ method: "POST", pathSuffix: "/files/upload-url" },
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

		const message: string = accessUser.isEmailVerified
			? "Set up two-factor authentication to access this resource."
			: "Verify your email address and set up two-factor authentication to access this resource.";

		throw new ForbiddenException({
			message,
			error: "RESTRICTED_SESSION",
		});
	}

	/**
	 * Decides on the route template only: `GET /admin/users#/merchant/me` is routed to `/admin/users`, so its
	 * template is `/admin/users` whatever the raw target says. No template (no route matched) is never allowlisted.
	 */
	private isAllowlistedRoute(request: FastifyRequest): boolean {
		const method: string = request.method.toUpperCase();
		const path: string | undefined = routeTemplateOf(request);
		if (path === undefined) {
			return false;
		}

		if (method === "GET" && path.includes("/merchant/kyb/documents/") && path.endsWith("/download")) {
			return true;
		}

		if (path.includes("/files/")) {
			if (method === "POST" && (path.endsWith("/complete") || path.endsWith("/local-upload"))) {
				return true;
			}
			if (method === "GET" && path.endsWith("/download-url")) {
				return true;
			}
			if (method === "GET" && /\/files\/:[A-Za-z]+$/u.test(path)) {
				return true;
			}
		}

		return RESTRICTED_SESSION_ALLOWLIST.some((rule: RestrictedRouteRule): boolean => method === rule.method && path.endsWith(rule.pathSuffix));
	}
}

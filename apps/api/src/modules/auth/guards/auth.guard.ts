import { CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";

import { RequestContextService } from "../../../common/context/request-context";
import { DependencyUnavailableError } from "../../../common/errors/app-error";
import { readFirstHeader } from "../../../common/utils/http-headers";
import { hasApiKeyAuthOnRequest } from "../../api-keys/types/api-key-auth-request";

import { AccessTokenStateService } from "../services/access-token-state.service";
import { ImpersonationSessionStateService } from "../services/impersonation-session-state.service";
import { TokenService } from "../services/token.service";
import type { AccessTokenPayload } from "../services/token.service";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

const BEARER_PREFIX = "Bearer ";

/**
 * The token of an `Authorization: Bearer <token>` header, or `undefined` when
 * there is none. A blank bearer (`"Bearer "`, sent by API tools whose token
 * field is empty) counts as NO bearer, so it never hides a valid session cookie.
 */
export function readBearerToken(authorization: string | undefined): string | undefined {
	if (authorization?.startsWith(BEARER_PREFIX) !== true) {
		return undefined;
	}
	const token: string = authorization.slice(BEARER_PREFIX.length).trim();
	return token.length > 0 ? token : undefined;
}

/**
 * Guard that validates the JWT access token.
 *
 * Supports two authentication methods:
 * 1. **Cookie-based** (browsers): Reads from `request.cookies["accessToken"]`
 * 2. **Bearer header** (Swagger UI / API clients): Reads from
 *    `Authorization: Bearer <token>`
 *
 * The Bearer header takes priority over the cookie. If both are absent,
 * the guard throws an `UnauthorizedException`.
 *
 * Failure mapping:
 * - a missing, malformed, expired, or revoked token (stale `tokenVersion`,
 *   inactive/deleted account, ended impersonation session) → 401
 * - the revocation state could not be READ (database / cache outage) → 503
 *   `SERVICE_UNAVAILABLE`, never a 401 that would log a valid user out
 *
 * - Skips authentication for routes decorated with `@Public()`
 * - Attaches the decoded payload to `request.user` on the JWT path and binds
 *   the principal (user + impersonator) into the request context (ADR 017)
 */
@Injectable()
export class AuthGuard implements CanActivate {
	public constructor(
		private readonly tokenService: TokenService,
		private readonly accessTokenState: AccessTokenStateService,
		private readonly impersonationSessions: ImpersonationSessionStateService,
		private readonly reflector: Reflector,
		private readonly requestContext: RequestContextService,
	) {}

	public async canActivate(context: ExecutionContext): Promise<boolean> {
		const isPublic: boolean = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);

		if (isPublic) return true;

		const request: FastifyRequest = context.switchToHttp().getRequest<FastifyRequest>();

		if (hasApiKeyAuthOnRequest(request)) {
			return true;
		}

		const bearer: string | undefined = readBearerToken(request.headers.authorization);

		// Web and admin use isolated cookie pairs so logout in one app does not
		// clear the session in the other. Pick the cookie set from X-Client-Type.
		const clientType: string | undefined = readFirstHeader(request.headers["x-client-type"]);
		const isAdmin: boolean = clientType === "admin";
		const isMerchant: boolean = clientType === "merchant";
		const token: string | undefined = isAdmin
			? (bearer ?? request.cookies.adminAccessToken)
			: isMerchant
				? (bearer ?? request.cookies.merchantAccessToken)
				: (bearer ?? request.cookies.accessToken);

		if (!token) {
			throw new UnauthorizedException({
				message: "Authentication required. Send a Bearer token or ensure the access token cookie is set.",
				error: "ACCESS_TOKEN_MISSING",
			});
		}

		// Signature / expiry / claim-shape failures are all 401s from TokenService.
		const payload: AccessTokenPayload = await this.tokenService.verifyAccessToken(token);
		await this.assertTokenNotRevoked(payload);

		request.user = payload;
		this.requestContext.bindPrincipal({
			userId: payload.sub,
			impersonatorId: payload.isImpersonating === true ? payload.originalUserId : undefined,
		});
		return true;
	}

	/**
	 * Server-side revocation state: account `tokenVersion` / active / deleted,
	 * and the impersonation session for impersonation tokens. A genuine
	 * revocation is a 401; failing to READ the state is an infrastructure fault
	 * (503) — the token may well be valid, so the caller must not be logged out.
	 */
	private async assertTokenNotRevoked(payload: AccessTokenPayload): Promise<void> {
		try {
			await this.accessTokenState.assertTokenValid(payload.sub, payload.tokenVersion);
			await this.impersonationSessions.assertLiveIfImpersonating(payload);
		} catch (error) {
			if (error instanceof UnauthorizedException) {
				throw error;
			}
			throw new DependencyUnavailableError({
				message: "Session validation is temporarily unavailable. Please retry.",
				...(error instanceof Error ? { cause: error } : {}),
			});
		}
	}
}

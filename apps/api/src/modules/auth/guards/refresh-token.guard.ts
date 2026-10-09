import { CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { AUTH_COOKIE_NAMES, isBrowserClientType, RefreshTokenInputSchema, type AuthClientType } from "@workspace/shared";
import type { FastifyRequest } from "fastify";

import { RequestContextService, type RequestPrincipalAuthMethod } from "../../../common/context/request-context";
import { ValidationError } from "../../../common/errors/app-error";

import { TokenService, type RefreshTokenPayload } from "../services/token.service";
import { resolveRequestClientType } from "../utils/client-type";

/** What a refresh-token reader needs from the request (a request without a payload has no body). */
export type RefreshTokenSource = Pick<FastifyRequest, "headers" | "query" | "cookies"> & Partial<Pick<FastifyRequest, "body">>;

/**
 * The raw refresh-token JWT a request presents, read ONLY from the source its
 * client type is allowed to use (ADR 029), or `undefined` when there is none:
 *
 * - browser client types (`web` / `admin` / `merchant`): the app-specific
 *   httpOnly cookie (`AUTH_COOKIE_NAMES`). A refresh token in the request
 *   BODY is rejected — 401 `REFRESH_TOKEN_TRANSPORT_MISMATCH` — never silently
 *   accepted or ignored, so a page script can never present a token it read
 *   somewhere as if it were the cookie.
 * - `mobile`: the `{ refreshToken }` request body. A cookie is never read.
 *
 * The body is untrusted input and is parsed here, at the boundary, with the
 * route's shared schema (`RefreshTokenInputSchema`: empty, absent or
 * `{ refreshToken }`); anything else is a 400 `VALIDATION_ERROR`.
 */
export function readPresentedRefreshToken(request: RefreshTokenSource): string | undefined {
	const body = RefreshTokenInputSchema.safeParse(request.body);
	if (!body.success) {
		throw new ValidationError({ message: "The request body must be empty or { refreshToken }." });
	}
	const bodyToken: string | undefined = body.data.refreshToken;
	const clientType: AuthClientType = resolveRequestClientType(request);

	if (!isBrowserClientType(clientType)) {
		return bodyToken;
	}
	if (bodyToken !== undefined) {
		throw new UnauthorizedException({
			message: "This client type presents its refresh token as an httpOnly cookie, never in the request body.",
			error: "REFRESH_TOKEN_TRANSPORT_MISMATCH",
		});
	}
	const cookie: string | undefined = request.cookies[AUTH_COOKIE_NAMES[clientType].refreshToken];
	return cookie === undefined || cookie.length === 0 ? undefined : cookie;
}

/**
 * How the request presented its refresh token, for the audit trail: the
 * browser cookie, or the `{ refreshToken }` body of client type `mobile`
 * ({@link readPresentedRefreshToken} accepts no other source per client type).
 */
export function refreshTokenAuthMethod(request: Pick<FastifyRequest, "headers" | "query">): Extract<RequestPrincipalAuthMethod, "REFRESH_COOKIE" | "REFRESH_BODY"> {
	return isBrowserClientType(resolveRequestClientType(request)) ? "REFRESH_COOKIE" : "REFRESH_BODY";
}

/**
 * Guard that validates the refresh-token JWT a request presents.
 *
 * - Reads the refresh token from the source the request's client type may
 *   use ({@link readPresentedRefreshToken}: the app's httpOnly cookie for
 *   browsers, the `{ refreshToken }` body for `mobile`)
 * - Verifies the token and extracts the `RefreshTokenPayload`
 * - Attaches the decoded payload to `request.user` and binds the token
 *   subject as the request-context principal (ADR 017)
 *
 * The user object will have `sub`, `email`, `jti`, and `tokenType` properties.
 */
@Injectable()
export class RefreshTokenGuard implements CanActivate {
	public constructor(
		private readonly tokenService: TokenService,
		private readonly requestContext: RequestContextService,
	) {}

	public async canActivate(context: ExecutionContext): Promise<boolean> {
		const request: FastifyRequest = context.switchToHttp().getRequest<FastifyRequest>();
		const token: string | undefined = readPresentedRefreshToken(request);

		if (token === undefined) {
			throw new UnauthorizedException({
				message: "Refresh token not found",
				error: "REFRESH_TOKEN_MISSING",
			});
		}

		let payload: RefreshTokenPayload;
		try {
			payload = await this.tokenService.verifyRefreshToken(token);
		} catch {
			throw new UnauthorizedException({
				message: "Invalid or expired refresh token",
				error: "REFRESH_TOKEN_INVALID",
			});
		}
		request.user = payload;
		this.requestContext.bindPrincipal({ userId: payload.sub, impersonatorId: undefined, impersonationSessionId: undefined, authMethod: refreshTokenAuthMethod(request) });
		return true;
	}
}

/**
 * Like {@link RefreshTokenGuard}, but never blocks on a MISSING or INVALID
 * token: with a valid refresh token the payload is attached to `request.user`
 * (and bound as the principal); with a missing, invalid or expired one the
 * request proceeds anonymously.
 *
 * For `POST /auth/logout`, which must be idempotent: a client whose refresh
 * token is gone (expired, or a guest) still gets its stale httpOnly cookies
 * cleared — JavaScript cannot clear them itself — instead of a 401 that left
 * them in place.
 *
 * A token presented through the WRONG source for the client type (401
 * `REFRESH_TOKEN_TRANSPORT_MISMATCH`) and a malformed body (400) still fail:
 * they are client errors, not an absent session.
 */
@Injectable()
export class OptionalRefreshTokenGuard implements CanActivate {
	/** The strict guard does the reading and verifying; this one only refuses to block. */
	private readonly refreshTokenGuard: RefreshTokenGuard;

	public constructor(tokenService: TokenService, requestContext: RequestContextService) {
		this.refreshTokenGuard = new RefreshTokenGuard(tokenService, requestContext);
	}

	public async canActivate(context: ExecutionContext): Promise<boolean> {
		// Throws for a wrong-source token or a malformed body — before the lenient part below.
		readPresentedRefreshToken(context.switchToHttp().getRequest<FastifyRequest>());
		try {
			await this.refreshTokenGuard.canActivate(context);
		} catch (error) {
			if (!(error instanceof UnauthorizedException)) {
				throw error;
			}
		}
		return true;
	}
}

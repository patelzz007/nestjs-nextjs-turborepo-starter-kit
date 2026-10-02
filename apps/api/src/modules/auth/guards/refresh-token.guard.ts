import { CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import { RequestContextService } from "../../../common/context/request-context";
import { readFirstHeader } from "../../../common/utils/http-headers";

import { TokenService, type RefreshTokenPayload } from "../services/token.service";

/**
 * Guard that validates the refresh token JWT from an httpOnly cookie.
 *
 * - Reads the refresh token from the app-specific httpOnly cookie
 *   (`refreshToken` for web, `adminRefreshToken` for admin via `X-Client-Type`)
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
		const clientType: string | undefined = readFirstHeader(request.headers["x-client-type"]);
		const isAdmin: boolean = clientType === "admin";
		const isMerchant: boolean = clientType === "merchant";
		const token: string | undefined = isAdmin ? request.cookies.adminRefreshToken : isMerchant ? request.cookies.merchantRefreshToken : request.cookies.refreshToken;

		if (!token) {
			throw new UnauthorizedException({
				message: "Refresh token not found",
				error: "REFRESH_TOKEN_MISSING",
			});
		}

		try {
			const payload: RefreshTokenPayload = await this.tokenService.verifyRefreshToken(token);
			request.user = payload;
			this.requestContext.bindPrincipal({ userId: payload.sub, impersonatorId: undefined });
			return true;
		} catch {
			throw new UnauthorizedException({
				message: "Invalid or expired refresh token",
				error: "REFRESH_TOKEN_INVALID",
			});
		}
	}
}

/**
 * Like {@link RefreshTokenGuard}, but never blocks: with a valid refresh token
 * the payload is attached to `request.user` (and bound as the principal); with
 * a missing, invalid or expired one the request proceeds anonymously.
 *
 * For `POST /auth/logout`, which must be idempotent: a client whose refresh
 * token is gone (expired, or a guest) still gets its stale httpOnly cookies
 * cleared — JavaScript cannot clear them itself — instead of a 401 that left
 * them in place.
 */
@Injectable()
export class OptionalRefreshTokenGuard implements CanActivate {
	/** The strict guard does the reading and verifying; this one only refuses to block. */
	private readonly refreshTokenGuard: RefreshTokenGuard;

	public constructor(tokenService: TokenService, requestContext: RequestContextService) {
		this.refreshTokenGuard = new RefreshTokenGuard(tokenService, requestContext);
	}

	public async canActivate(context: ExecutionContext): Promise<boolean> {
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

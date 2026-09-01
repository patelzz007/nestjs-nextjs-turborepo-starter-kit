import { CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import { readFirstHeader } from "../../../common/utils/http-headers";

import { TokenService, type RefreshTokenPayload } from "../services/token.service";

/**
 * Guard that validates the refresh token JWT from an httpOnly cookie.
 *
 * - Reads the refresh token from the app-specific httpOnly cookie
 *   (`refreshToken` for web, `adminRefreshToken` for admin via `X-Client-Type`)
 * - Verifies the token and extracts the `RefreshTokenPayload`
 * - Attaches the decoded payload to `request.user`
 *
 * The user object will have `sub`, `email`, `jti`, and `tokenType` properties.
 */
@Injectable()
export class RefreshTokenGuard implements CanActivate {
	constructor(private readonly tokenService: TokenService) {}

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
			return true;
		} catch {
			throw new UnauthorizedException({
				message: "Invalid or expired refresh token",
				error: "REFRESH_TOKEN_INVALID",
			});
		}
	}
}

import { CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";

import { TokenService, type RefreshTokenPayload } from "../../modules/auth/services/token.service.js";

/**
 * Guard that validates the refresh token JWT from an httpOnly cookie.
 *
 * - Reads the refresh token from the `refreshToken` cookie
 * - Verifies the token and extracts the `RefreshTokenPayload`
 * - Attaches the decoded payload to `request.user`
 *
 * The user object will have `sub`, `email`, `jti`, and `tokenType` properties.
 */
@Injectable()
export class RefreshTokenGuard implements CanActivate {
	constructor(private readonly tokenService: TokenService) {}

	public async canActivate(context: ExecutionContext): Promise<boolean> {
		const request: Request = context.switchToHttp().getRequest<Request>();
		// Check both refreshToken and adminRefreshToken since the admin panel
		// uses isolated cookie names for cookie path isolation.
		const token: string | undefined = request.cookies.refreshToken ?? request.cookies.adminRefreshToken;

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

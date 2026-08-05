import { CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";

import { TokenService } from "../../modules/auth/services/token.service.js";
import type { AccessTokenPayload } from "../../modules/auth/services/token.service.js";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator.js";

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
 * - Skips authentication for routes decorated with `@Public()`
 * - Attaches the decoded payload to `request.user`
 */
@Injectable()
export class AuthGuard implements CanActivate {
	constructor(
		private readonly tokenService: TokenService,
		private readonly reflector: Reflector,
	) {}

	public async canActivate(context: ExecutionContext): Promise<boolean> {
		// Skip authentication for public routes
		const isPublic: boolean = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);

		if (isPublic) return true;

		const request: Request = context.switchToHttp().getRequest<Request>();

		// Try Authorization: Bearer header first (Swagger UI / API clients)
		// Fall back to httpOnly cookie(s). Check both accessToken and
		// adminAccessToken since the admin panel uses isolated cookie names.
		const authorization: string | undefined = request.headers.authorization;
		const token: string | undefined =
			(authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined) ?? request.cookies.accessToken ?? request.cookies.adminAccessToken;

		if (!token) {
			throw new UnauthorizedException({
				message: "Authentication required. Send a Bearer token or ensure the access token cookie is set.",
				error: "ACCESS_TOKEN_MISSING",
			});
		}

		try {
			const payload: AccessTokenPayload = await this.tokenService.verifyAccessToken(token);
			request.user = payload;
			return true;
		} catch {
			throw new UnauthorizedException({
				message: "Invalid or expired access token",
				error: "ACCESS_TOKEN_INVALID",
			});
		}
	}
}

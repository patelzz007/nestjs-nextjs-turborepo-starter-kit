import { CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";

import { readFirstHeader } from "../../../common/utils/http-headers";

import { TokenService } from "../services/token.service";
import type { AccessTokenPayload } from "../services/token.service";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

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
 * - Attaches the decoded payload to `request.user` on the JWT path
 */
@Injectable()
export class AuthGuard implements CanActivate {
	public constructor(
		private readonly tokenService: TokenService,
		private readonly reflector: Reflector,
	) {}

	public async canActivate(context: ExecutionContext): Promise<boolean> {
		const isPublic: boolean = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);

		if (isPublic) return true;

		const request: FastifyRequest = context.switchToHttp().getRequest<FastifyRequest>();

		const authorization: string | undefined = request.headers.authorization;
		const bearer: string | undefined = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;

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

import { CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";
import { createHash, timingSafeEqual } from "node:crypto";

import { TypedConfigService } from "../../../config/typed-config.service";
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
 * When `TELESCOPE_TOKEN` is set, a matching Bearer token is accepted **before**
 * JWT verify so the Telescope CLI/CI path can reach `TelescopeAdminGuard`
 * (that guard still compares the same token). No `request.user` is attached.
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
		private readonly config: TypedConfigService,
	) {}

	public async canActivate(context: ExecutionContext): Promise<boolean> {
		const isPublic: boolean = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);

		if (isPublic) return true;

		const request: FastifyRequest = context.switchToHttp().getRequest<FastifyRequest>();

		const authorization: string | undefined = request.headers.authorization;
		const bearer: string | undefined = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;

		const telescopeToken: string = this.config.telescopeToken;
		if (telescopeToken.length > 0 && bearer !== undefined && this.secureEquals(bearer, telescopeToken)) {
			return true;
		}

		const token: string | undefined = bearer ?? request.cookies.accessToken ?? request.cookies.adminAccessToken;

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

	private secureEquals(a: string, b: string): boolean {
		const hashA: Buffer = createHash("sha256").update(a).digest();
		const hashB: Buffer = createHash("sha256").update(b).digest();
		return timingSafeEqual(hashA, hashB);
	}
}

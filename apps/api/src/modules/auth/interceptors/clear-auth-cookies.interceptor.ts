import { Injectable, type NestInterceptor, type ExecutionContext, type CallHandler } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { type Observable } from "rxjs";
import { tap } from "rxjs/operators";

import type { JsonValue } from "../../../common/interfaces/json";
import {
	CookieConfigService,
	ACCESS_TOKEN_COOKIE_NAME,
	REFRESH_TOKEN_COOKIE_NAME,
	ADMIN_ACCESS_TOKEN_COOKIE_NAME,
	ADMIN_REFRESH_TOKEN_COOKIE_NAME,
} from "../constants/cookie.config";
import { CookieService } from "../services/cookies.service";

/**
 * Interceptor that clears auth cookies after the route handler completes.
 *
 * Reads the `X-Client-Type` header to determine which cookie set to clear:
 * - `admin`: clears `adminAccessToken` / `adminRefreshToken`
 * - anything else (or unset): clears `accessToken` / `refreshToken`
 *
 * This prevents a logout in one app from clearing the other app's cookies.
 * Previously all 4 cookies were cleared regardless of client type.
 *
 * @example
 * ```typescript
 * @UseInterceptors(ClearAuthCookiesInterceptor)
 * @Post("/logout")
 * public async logout(@GetUser() user: ...): Promise<LogoutResponse> {
 *   return this.authService.logoutDevice(...);
 * }
 * ```
 */
@Injectable()
export class ClearAuthCookiesInterceptor implements NestInterceptor {
	constructor(private readonly cookieConfig: CookieConfigService) {}

	public intercept(context: ExecutionContext, next: CallHandler): Observable<JsonValue> {
		const request: FastifyRequest = context.switchToHttp().getRequest<FastifyRequest>();
		const response: FastifyReply = context.switchToHttp().getResponse<FastifyReply>();

		// Determine which cookie set to clear based on X-Client-Type header.
		const header: string | string[] | undefined = request.headers["x-client-type"];
		const clientType: string | undefined = typeof header === "string" ? header : undefined;
		const isAdmin: boolean = clientType === "admin";

		return next.handle().pipe(
			tap(() => {
				if (isAdmin) {
					// Only clear admin cookies — leave web cookies intact
					CookieService.setCookie(response, ADMIN_ACCESS_TOKEN_COOKIE_NAME, null, this.cookieConfig.accessTokenOptions);
					CookieService.setCookie(response, ADMIN_REFRESH_TOKEN_COOKIE_NAME, null, this.cookieConfig.refreshTokenOptions);
				} else {
					// Only clear web cookies — leave admin cookies intact
					CookieService.setCookie(response, ACCESS_TOKEN_COOKIE_NAME, null, this.cookieConfig.accessTokenOptions);
					CookieService.setCookie(response, REFRESH_TOKEN_COOKIE_NAME, null, this.cookieConfig.refreshTokenOptions);
				}
			}),
		);
	}
}

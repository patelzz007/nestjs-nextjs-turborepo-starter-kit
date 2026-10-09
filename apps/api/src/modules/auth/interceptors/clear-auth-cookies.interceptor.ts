import { Injectable, type NestInterceptor, type ExecutionContext, type CallHandler } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { type Observable } from "rxjs";
import { tap } from "rxjs/operators";

import { AUTH_COOKIE_NAMES, isBrowserClientType, RevokeSessionResponseSchema, type AuthClientType, type AuthCookieNamePair, type JsonValue } from "@workspace/shared";

import { CookieConfigService } from "../constants/cookie.config";
import { CookieService } from "../services/cookies.service";
import { resolveRequestClientType } from "../utils/client-type";

/** The cookie pair the request's client type uses, or `undefined` for `mobile` (no cookies — ADR 029). */
function authCookieNamesOf(request: FastifyRequest): AuthCookieNamePair | undefined {
	const clientType: AuthClientType = resolveRequestClientType(request);
	return isBrowserClientType(clientType) ? AUTH_COOKIE_NAMES[clientType] : undefined;
}

/** Expire the access and refresh cookie of one pair. */
function clearAuthCookies(response: FastifyReply, cookieNames: AuthCookieNamePair, cookieConfig: CookieConfigService): void {
	CookieService.setCookie(response, cookieNames.accessToken, null, cookieConfig.accessTokenOptions);
	CookieService.setCookie(response, cookieNames.refreshToken, null, cookieConfig.refreshTokenOptions);
}

/**
 * Interceptor that clears auth cookies after the route handler completes.
 *
 * Clears ONLY the cookie pair of the request's client type
 * (`AUTH_COOKIE_NAMES`: `web` → `accessToken` / `refreshToken`, `admin` →
 * `adminAccessToken` / `adminRefreshToken`, `merchant` → `merchantAccessToken` /
 * `merchantRefreshToken`), so a logout in one app never clears another app's
 * session. Client type `mobile` has no cookies (ADR 029): nothing is cleared —
 * the app deletes its tokens from its own secure store.
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
	public constructor(private readonly cookieConfig: CookieConfigService) {}

	public intercept(context: ExecutionContext, next: CallHandler): Observable<JsonValue> {
		const request: FastifyRequest = context.switchToHttp().getRequest<FastifyRequest>();
		const response: FastifyReply = context.switchToHttp().getResponse<FastifyReply>();
		const cookieNames: AuthCookieNamePair | undefined = authCookieNamesOf(request);

		return next.handle().pipe(
			tap((): void => {
				if (cookieNames === undefined) {
					return;
				}
				clearAuthCookies(response, cookieNames, this.cookieConfig);
			}),
		);
	}
}

/**
 * For `POST /auth/sessions/:sessionId/revoke`: clears the request's auth
 * cookies only when the handler revoked the caller's OWN session
 * (`revokedCurrentSession: true`) — revoking the current device is a sign-out
 * (ADR 034); revoking another device leaves this one signed in. Client type
 * `mobile` has no cookies: the app drops its stored tokens itself.
 */
@Injectable()
export class ClearAuthCookiesOnSessionEndInterceptor implements NestInterceptor {
	public constructor(private readonly cookieConfig: CookieConfigService) {}

	public intercept(context: ExecutionContext, next: CallHandler): Observable<JsonValue> {
		const request: FastifyRequest = context.switchToHttp().getRequest<FastifyRequest>();
		const response: FastifyReply = context.switchToHttp().getResponse<FastifyReply>();
		const cookieNames: AuthCookieNamePair | undefined = authCookieNamesOf(request);

		return next.handle().pipe(
			tap((body: JsonValue): void => {
				const result = RevokeSessionResponseSchema.safeParse(body);
				if (cookieNames === undefined || !result.success || !result.data.revokedCurrentSession) {
					return;
				}
				clearAuthCookies(response, cookieNames, this.cookieConfig);
			}),
		);
	}
}

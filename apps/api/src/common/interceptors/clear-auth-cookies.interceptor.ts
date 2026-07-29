import { Injectable, type NestInterceptor, type ExecutionContext, type CallHandler } from "@nestjs/common";
import { type Observable } from "rxjs";
import { tap } from "rxjs/operators";
import type { Response } from "express";
import { CookieService } from "../services/cookies.service";
import { CookieConfigService, ACCESS_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_NAME } from "../constants/cookie.config";
import type { JsonValue } from "../../types/json";

/**
 * Interceptor that clears both auth cookies (accessToken and refreshToken)
 * after the route handler completes successfully.
 *
 * Used on logout endpoints so the controller never needs to call
 * `res.clearCookie()` directly.
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
		const response: Response = context.switchToHttp().getResponse<Response>();

		return next.handle().pipe(
			tap(() => {
				CookieService.setCookie(response, ACCESS_TOKEN_COOKIE_NAME, null, this.cookieConfig.accessTokenOptions);
				CookieService.setCookie(response, REFRESH_TOKEN_COOKIE_NAME, null, this.cookieConfig.refreshTokenOptions);
			}),
		);
	}
}

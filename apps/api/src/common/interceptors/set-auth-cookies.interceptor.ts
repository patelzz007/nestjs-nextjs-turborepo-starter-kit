import { Injectable, type NestInterceptor, type ExecutionContext, type CallHandler } from "@nestjs/common";
import { type Observable } from "rxjs";
import { map, tap } from "rxjs/operators";
import type { Response } from "express";
import { CookieService } from "../services/cookies.service";
import { CookieConfigService, ACCESS_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_NAME } from "../constants/cookie.config";
import type { JsonValue } from "../../types/json";

/**
 * Interceptor that extracts `accessToken` and `refreshToken` from the response
 * body, sets them as httpOnly cookies, and strips them from the JSON response.
 *
 * Used on login and token-refresh endpoints so the controller never touches
 * `res.cookie()` directly — it simply returns tokens in the body.
 *
 * @example
 * ```typescript
 * @UseInterceptors(SetAuthCookiesInterceptor)
 * @Post("/login")
 * public async login(@Body() dto: LoginDto): Promise<LoginServiceResponse> {
 *   return this.authService.login(dto, ...);
 * }
 * ```
 */
@Injectable()
export class SetAuthCookiesInterceptor implements NestInterceptor {
	constructor(private readonly cookieConfig: CookieConfigService) {}

	public intercept(context: ExecutionContext, next: CallHandler): Observable<JsonValue> {
		const response: Response = context.switchToHttp().getResponse<Response>();

		return next.handle().pipe(
			tap((data: JsonValue) => {
				if (data !== null && !Array.isArray(data) && typeof data === "object") {
					const record: Record<string, JsonValue> = data as Record<string, JsonValue>;
					const accessToken: JsonValue | undefined = record["accessToken"];
					const refreshToken: JsonValue | undefined = record["refreshToken"];

					if (typeof accessToken === "string" && accessToken.length > 0) {
						CookieService.setCookie(response, ACCESS_TOKEN_COOKIE_NAME, accessToken, this.cookieConfig.accessTokenOptions);
					}
					if (typeof refreshToken === "string" && refreshToken.length > 0) {
						CookieService.setCookie(response, REFRESH_TOKEN_COOKIE_NAME, refreshToken, this.cookieConfig.refreshTokenOptions);
					}
				}
			}),
			map((data: JsonValue) => {
				if (data !== null && !Array.isArray(data) && typeof data === "object") {
					const record: Record<string, JsonValue> = data as Record<string, JsonValue>;
					const rest: Record<string, JsonValue> = {};
					for (const key of Object.keys(record)) {
						if (key !== "accessToken" && key !== "refreshToken") {
							rest[key] = record[key] as JsonValue;
						}
					}
					return rest as JsonValue;
				}
				return data;
			}),
		);
	}
}

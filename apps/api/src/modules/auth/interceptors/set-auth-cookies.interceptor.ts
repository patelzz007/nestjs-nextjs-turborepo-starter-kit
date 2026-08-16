import { Injectable, type NestInterceptor, type ExecutionContext, type CallHandler } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { type Observable } from "rxjs";
import { map, tap } from "rxjs/operators";

import type { JsonValue } from "../../../common/interfaces/json";
import {
	CookieConfigService,
	ACCESS_TOKEN_COOKIE_NAME,
	REFRESH_TOKEN_COOKIE_NAME,
	ADMIN_ACCESS_TOKEN_COOKIE_NAME,
	ADMIN_REFRESH_TOKEN_COOKIE_NAME,
	type CookieNames,
} from "../constants/cookie.config";
import { CookieService } from "../services/cookies.service";

/**
 * Reads a query parameter without type assertions: Fastify types the query
 * string as opaque, so iterate the entries and keep only string values.
 */
function readQueryStringValue(request: FastifyRequest, name: string): string | undefined {
	if (typeof request.query !== "object" || request.query === null) {
		return undefined;
	}
	for (const [key, value] of Object.entries(request.query)) {
		if (key === name && typeof value === "string") {
			return value;
		}
	}
	return undefined;
}

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
		const request: FastifyRequest = context.switchToHttp().getRequest<FastifyRequest>();
		const response: FastifyReply = context.switchToHttp().getResponse<FastifyReply>();

		// Determine which cookie names to use based on X-Client-Type header or
		// client_type query parameter (used by Swagger UI which cannot send
		// custom headers in the browser's native fetch to the docs page).
		// This isolates admin cookies from web cookies on the same host.
		const headerValue: string | string[] | undefined = request.headers["x-client-type"];
		const headerType: string | undefined = typeof headerValue === "string" ? headerValue : undefined;
		const queryValue: string | undefined = readQueryStringValue(request, "client_type");
		const clientType: string | undefined = headerType ?? queryValue;
		const isAdmin: boolean = clientType === "admin";
		const accessTokenName: CookieNames = isAdmin ? ADMIN_ACCESS_TOKEN_COOKIE_NAME : ACCESS_TOKEN_COOKIE_NAME;
		const refreshTokenName: CookieNames = isAdmin ? ADMIN_REFRESH_TOKEN_COOKIE_NAME : REFRESH_TOKEN_COOKIE_NAME;

		return next.handle().pipe(
			tap((data: JsonValue) => {
				if (data !== null && !Array.isArray(data) && typeof data === "object") {
					const record: Record<string, JsonValue> = data;
					const accessToken: JsonValue | undefined = record.accessToken;
					const refreshToken: JsonValue | undefined = record.refreshToken;

					if (typeof accessToken === "string" && accessToken.length > 0) {
						CookieService.setCookie(response, accessTokenName, accessToken, this.cookieConfig.accessTokenOptions);
					}
					if (typeof refreshToken === "string" && refreshToken.length > 0) {
						CookieService.setCookie(response, refreshTokenName, refreshToken, this.cookieConfig.refreshTokenOptions);
					}
				}
			}),
			map((data: JsonValue) => {
				if (data !== null && !Array.isArray(data) && typeof data === "object") {
					const record: Record<string, JsonValue> = data;
					const rest: Record<string, JsonValue> = {};
					for (const key of Object.keys(record)) {
						if (key !== "accessToken" && key !== "refreshToken") {
							rest[key] = record[key];
						}
					}
					return rest;
				}
				return data;
			}),
		);
	}
}

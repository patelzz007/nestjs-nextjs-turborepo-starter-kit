import { Injectable, type NestInterceptor, type ExecutionContext, type CallHandler } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { type Observable } from "rxjs";
import { map, tap } from "rxjs/operators";

import { FastifyQuerySchema, JsonObjectSchema, LoginTokenFieldsSchema, type JsonValue } from "@workspace/shared";

import { readFirstHeader, readQueryParam } from "../../../common/utils/http-headers";
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
 * Interceptor that extracts `accessToken` and `refreshToken` from the response
 * body, sets them as httpOnly cookies, and strips them from the JSON response.
 */
@Injectable()
export class SetAuthCookiesInterceptor implements NestInterceptor {
	constructor(private readonly cookieConfig: CookieConfigService) {}

	public intercept(context: ExecutionContext, next: CallHandler): Observable<JsonValue> {
		const request: FastifyRequest = context.switchToHttp().getRequest<FastifyRequest>();
		const response: FastifyReply = context.switchToHttp().getResponse<FastifyReply>();

		const headerType: string | undefined = readFirstHeader(request.headers["x-client-type"]);
		const queryParsed = FastifyQuerySchema.safeParse(request.query);
		const queryValue: string | undefined = queryParsed.success ? readQueryParam(queryParsed.data, "client_type") : undefined;
		const clientType: string | undefined = headerType ?? queryValue;
		const isAdmin: boolean = clientType === "admin";
		const accessTokenName: CookieNames = isAdmin ? ADMIN_ACCESS_TOKEN_COOKIE_NAME : ACCESS_TOKEN_COOKIE_NAME;
		const refreshTokenName: CookieNames = isAdmin ? ADMIN_REFRESH_TOKEN_COOKIE_NAME : REFRESH_TOKEN_COOKIE_NAME;

		return next.handle().pipe(
			tap((data: JsonValue) => {
				const body = JsonObjectSchema.safeParse(data);
				if (!body.success) {
					return;
				}
				const tokens = LoginTokenFieldsSchema.safeParse(body.data);
				if (!tokens.success) {
					return;
				}
				if (tokens.data.accessToken !== undefined) {
					CookieService.setCookie(response, accessTokenName, tokens.data.accessToken, this.cookieConfig.accessTokenOptions);
				}
				if (tokens.data.refreshToken !== undefined) {
					CookieService.setCookie(response, refreshTokenName, tokens.data.refreshToken, this.cookieConfig.refreshTokenOptions);
				}
			}),
			map((data: JsonValue) => {
				const body = JsonObjectSchema.safeParse(data);
				if (!body.success) {
					return data;
				}
				return JsonObjectSchema.parse(
					Object.fromEntries(Object.entries(body.data).filter(([key]: readonly [string, JsonValue]): boolean => key !== "accessToken" && key !== "refreshToken")),
				);
			}),
		);
	}
}

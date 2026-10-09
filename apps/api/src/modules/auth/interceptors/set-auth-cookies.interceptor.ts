import { Injectable, type NestInterceptor, type ExecutionContext, type CallHandler } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { type Observable } from "rxjs";
import { map } from "rxjs/operators";

import {
	AUTH_COOKIE_NAMES,
	AuthTokenTransportSchema,
	isBrowserClientType,
	JsonObjectSchema,
	LoginTokenFieldsSchema,
	type AuthClientType,
	type AuthCookieNamePair,
	type JsonObject,
	type JsonValue,
} from "@workspace/shared";

import { CookieConfigService } from "../constants/cookie.config";
import { CookieService } from "../services/cookies.service";
import { resolveRequestClientType } from "../utils/client-type";

/** The token fields of a handler result — the only keys this interceptor moves. */
const TOKEN_FIELD_NAMES: ReadonlySet<string> = new Set<string>(["accessToken", "refreshToken"]);

/**
 * Delivers the session tokens a login-like handler returned, by the token
 * transport of the request's validated client type (ADR 029) — chosen on the
 * server, never by a client-controlled flag:
 *
 * - **Browser client types** (`web`, `admin`, `merchant`) — cookie transport:
 *   `accessToken` / `refreshToken` are set as that app's httpOnly cookies
 *   (`AUTH_COOKIE_NAMES`) and stripped from the JSON body.
 * - **`mobile`** — body transport: no cookie is set; the tokens stay in the
 *   body and, when BOTH are present, the body is marked
 *   `tokenTransport: "body"`. Only that marker lets the response contract's
 *   token-bearing variant match (`LoginClientResponseSchema`,
 *   `RefreshClientResponseSchema`), so a browser body can never carry a token
 *   to the wire even if it slipped past this interceptor.
 *
 * A result without both tokens (2FA / verification pending, impersonation's
 * access-token-only payload) gets no marker; its token fields are stripped by
 * the response contract, so `mobile` receives no impersonation token.
 */
@Injectable()
export class SetAuthCookiesInterceptor implements NestInterceptor {
	public constructor(private readonly cookieConfig: CookieConfigService) {}

	public intercept(context: ExecutionContext, next: CallHandler): Observable<JsonValue> {
		const request: FastifyRequest = context.switchToHttp().getRequest<FastifyRequest>();
		const response: FastifyReply = context.switchToHttp().getResponse<FastifyReply>();
		const clientType: AuthClientType = resolveRequestClientType(request);

		if (!isBrowserClientType(clientType)) {
			return next.handle().pipe(map((data: JsonValue): JsonValue => SetAuthCookiesInterceptor.markBodyTransport(data)));
		}

		const cookieNames: AuthCookieNamePair = AUTH_COOKIE_NAMES[clientType];
		return next.handle().pipe(map((data: JsonValue): JsonValue => this.moveTokensToCookies(data, response, cookieNames)));
	}

	/** Body transport: keep the tokens and add the marker the token-bearing contract variants require. */
	private static markBodyTransport(data: JsonValue): JsonValue {
		const body = JsonObjectSchema.safeParse(data);
		if (!body.success) {
			return data;
		}
		const tokens = LoginTokenFieldsSchema.safeParse(body.data);
		if (!tokens.success || tokens.data.accessToken === undefined || tokens.data.refreshToken === undefined) {
			return data;
		}
		return { ...body.data, tokenTransport: AuthTokenTransportSchema.enum.body };
	}

	/** Cookie transport: set the app's httpOnly cookies, then strip the tokens from the body. */
	private moveTokensToCookies(data: JsonValue, response: FastifyReply, cookieNames: AuthCookieNamePair): JsonValue {
		const body = JsonObjectSchema.safeParse(data);
		if (!body.success) {
			return data;
		}
		const tokens = LoginTokenFieldsSchema.safeParse(body.data);
		if (tokens.success && tokens.data.accessToken !== undefined) {
			CookieService.setCookie(response, cookieNames.accessToken, tokens.data.accessToken, this.cookieConfig.accessTokenOptions);
		}
		if (tokens.success && tokens.data.refreshToken !== undefined) {
			CookieService.setCookie(response, cookieNames.refreshToken, tokens.data.refreshToken, this.cookieConfig.refreshTokenOptions);
		}
		const withoutTokens: JsonObject = Object.fromEntries(Object.entries(body.data).filter(([key]: readonly [string, JsonValue]): boolean => !TOKEN_FIELD_NAMES.has(key)));
		return withoutTokens;
	}
}

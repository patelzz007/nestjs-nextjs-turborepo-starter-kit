import { Injectable, type NestInterceptor, type ExecutionContext, type CallHandler, BadRequestException } from "@nestjs/common";
import { type Observable } from "rxjs";
import { tap } from "rxjs/operators";
import type { Response } from "express";
import type { JsonValue } from "../../types/json";
import { CookieService } from "../services/cookies.service";
import type { CookieNames, ExtendedCookieOptions } from "../constants/cookie.config";
import { ACCESS_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_NAME } from "../constants/cookie.config";

/**
 * A single cookie operation to be performed by the CookieInterceptor.
 */
export interface CookieOperation {
	readonly name: CookieNames;
	readonly value: string | null | undefined;
	readonly options?: Partial<ExtendedCookieOptions>;
}

/**
 * Interceptor that sets or clears cookies on the HTTP response after the
 * route handler completes successfully.
 *
 * This decouples cookie management from the controller logic — the controller
 * returns tokens in the response body, and the interceptor sets them as
 * httpOnly cookies.
 *
 * Usage:
 * ```typescript
 * @UseInterceptors(withAuthCookies(accessToken, refreshToken))
 * @Post("/login")
 * public async login(...) { ... }
 * ```
 */
@Injectable()
export class CookieInterceptor<T = JsonValue> implements NestInterceptor<T, T> {
	constructor(private readonly cookieOperations: CookieOperation[] = []) {}

	public intercept(context: ExecutionContext, next: CallHandler<T>): Observable<T> {
		const response: Response = context.switchToHttp().getResponse<Response>();

		return next.handle().pipe(
			tap(() => {
				for (const operation of this.cookieOperations) {
					const result: { success: boolean; error?: Error } = CookieService.setCookie(response, operation.name, operation.value, operation.options);

					if (!result.success && result.error) {
						throw new BadRequestException(`Failed to set cookie: ${result.error.message}`);
					}
				}
			}),
		);
	}
}

/**
 * Create a CookieInterceptor with one or more cookie operations.
 *
 * @example
 * ```typescript
 * @UseInterceptors(createCookieInterceptor([
 *   { name: ACCESS_TOKEN_COOKIE_NAME, value: token },
 *   { name: REFRESH_TOKEN_COOKIE_NAME, value: refreshToken },
 * ]))
 * ```
 */
export const createCookieInterceptor = (operations: CookieOperation | CookieOperation[]): CookieInterceptor => {
	const operationsArray: CookieOperation[] = Array.isArray(operations) ? operations : [operations];
	return new CookieInterceptor(operationsArray);
};

/**
 * Create a CookieInterceptor that sets both auth cookies (access + refresh).
 * Used for login and token refresh endpoints.
 *
 * @example
 * ```typescript
 * @UseInterceptors(withAuthCookies(accessToken, refreshToken))
 * ```
 */
export const withAuthCookies = (accessToken: string, refreshToken: string): CookieInterceptor => {
	return new CookieInterceptor([
		{
			name: ACCESS_TOKEN_COOKIE_NAME,
			value: accessToken,
		},
		{
			name: REFRESH_TOKEN_COOKIE_NAME,
			value: refreshToken,
		},
	]);
};

/**
 * Create a CookieInterceptor that clears both auth cookies.
 * Used for logout endpoints.
 *
 * @example
 * ```typescript
 * @UseInterceptors(withClearAuthCookies())
 * ```
 */
export const withClearAuthCookies = (): CookieInterceptor => {
	return new CookieInterceptor([
		{
			name: ACCESS_TOKEN_COOKIE_NAME,
			value: null,
		},
		{
			name: REFRESH_TOKEN_COOKIE_NAME,
			value: null,
		},
	]);
};

import { Injectable, type NestInterceptor, type ExecutionContext, type CallHandler, BadRequestException } from "@nestjs/common";
import { type Observable } from "rxjs";
import { tap } from "rxjs/operators";
import type { Response } from "express";
import type { JsonValue } from "../../types/json";
import { CookieService } from "../services/cookies.service";
import type { CookieNames, ExtendedCookieOptions } from "../constants/cookie.config";
import { ACCESS_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_NAME, ADMIN_ACCESS_TOKEN_COOKIE_NAME, ADMIN_REFRESH_TOKEN_COOKIE_NAME } from "../constants/cookie.config";

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
 * Options for creating auth cookie interceptors.
 * Allows specifying which cookie name set to use.
 */
export interface AuthCookieOptions {
	readonly accessTokenName?: CookieNames;
	readonly refreshTokenName?: CookieNames;
}

/**
 * Create a CookieInterceptor that sets both auth cookies (access + refresh).
 * Supports both web (default) and admin cookie name sets.
 *
 * @example
 * ```typescript
 * // Web cookies
 * @UseInterceptors(withAuthCookies(accessToken, refreshToken))
 *
 * // Admin cookies
 * @UseInterceptors(withAuthCookies(accessToken, refreshToken, {
 *   accessTokenName: ADMIN_ACCESS_TOKEN_COOKIE_NAME,
 *   refreshTokenName: ADMIN_REFRESH_TOKEN_COOKIE_NAME,
 * }))
 * ```
 */
export const withAuthCookies = (accessToken: string, refreshToken: string, options?: AuthCookieOptions): CookieInterceptor => {
	const accessTokenName: CookieNames = options?.accessTokenName ?? ACCESS_TOKEN_COOKIE_NAME;
	const refreshTokenName: CookieNames = options?.refreshTokenName ?? REFRESH_TOKEN_COOKIE_NAME;

	return new CookieInterceptor([
		{
			name: accessTokenName,
			value: accessToken,
		},
		{
			name: refreshTokenName,
			value: refreshToken,
		},
	]);
};

/**
 * Create a CookieInterceptor that clears both auth cookies.
 * Supports both web (default) and admin cookie name sets.
 * Clears both sets by default for safety.
 *
 * @example
 * ```typescript
 * @UseInterceptors(withClearAuthCookies())
 * ```
 */
export const withClearAuthCookies = (options?: AuthCookieOptions): CookieInterceptor => {
	const accessTokenName: CookieNames = options?.accessTokenName ?? ACCESS_TOKEN_COOKIE_NAME;
	const refreshTokenName: CookieNames = options?.refreshTokenName ?? REFRESH_TOKEN_COOKIE_NAME;

	return new CookieInterceptor([
		{
			name: accessTokenName,
			value: null,
		},
		{
			name: refreshTokenName,
			value: null,
		},
	]);
};

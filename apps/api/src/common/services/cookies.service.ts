import type { Response } from "express";

import type { CookieNames, ExtendedCookieOptions } from "../constants/cookie.config";
import { ACCESS_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_NAME, ADMIN_ACCESS_TOKEN_COOKIE_NAME, ADMIN_REFRESH_TOKEN_COOKIE_NAME } from "../constants/cookie.config";

/**
 * Result of a cookie set/clear operation.
 */
export interface CookieResult {
	readonly success: boolean;
	readonly error?: Error;
}

/**
 * Service for setting and clearing httpOnly cookies with validation.
 *
 * All cookie names are validated against the allowed `CookieNames` union.
 * Values longer than 4096 bytes are rejected to respect browser limits.
 */
export class CookieService {
	/** Maximum cookie value length in bytes (most browsers: 4096) */
	private static readonly maxCookieValueBytes: number = 4096;

	/** Allowed cookie names */
	private static readonly allowedNames: readonly CookieNames[] = [
		ACCESS_TOKEN_COOKIE_NAME,
		REFRESH_TOKEN_COOKIE_NAME,
		ADMIN_ACCESS_TOKEN_COOKIE_NAME,
		ADMIN_REFRESH_TOKEN_COOKIE_NAME,
	];

	/**
	 * Set (or clear) a cookie on the response object.
	 *
	 * @param response - Express Response object
	 * @param name - Cookie name (validated against CookieNames union)
	 * @param value - Cookie value (null/undefined clears the cookie)
	 * @param options - Optional overrides for cookie options
	 *
	 * @returns A {@link CookieResult} indicating success or failure
	 */
	public static setCookie(response: Response, name: CookieNames, value: string | null | undefined, options?: Partial<ExtendedCookieOptions>): CookieResult {
		// Validate cookie name
		if (!CookieService.allowedNames.includes(name)) {
			return {
				success: false,
				error: new Error(`Invalid cookie name: "${name}". Allowed: ${CookieService.allowedNames.join(", ")}`),
			};
		}

		// Validate cookie value length (only for non-null values)
		if (value !== null && value !== undefined && Buffer.byteLength(value, "utf-8") > CookieService.maxCookieValueBytes) {
			return {
				success: false,
				error: new Error(`Cookie value for "${name}" exceeds ${String(CookieService.maxCookieValueBytes)} bytes`),
			};
		}

		// Determine default options
		const defaultOptions: ExtendedCookieOptions = {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			path: "/",
		};

		const mergedOptions: ExtendedCookieOptions = { ...defaultOptions, ...options };

		if (value === null || value === undefined) {
			response.clearCookie(name, mergedOptions);
		} else {
			response.cookie(name, value, mergedOptions);
		}

		return { success: true };
	}
}

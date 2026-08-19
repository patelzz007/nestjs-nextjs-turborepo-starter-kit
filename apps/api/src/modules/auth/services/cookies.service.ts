import { Injectable } from "@nestjs/common";
import type { FastifyReply } from "fastify";

import { type CookieResult } from "@workspace/shared";

import type { CookieNames, ExtendedCookieOptions } from "../constants/cookie.config";
import { ACCESS_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_NAME, ADMIN_ACCESS_TOKEN_COOKIE_NAME, ADMIN_REFRESH_TOKEN_COOKIE_NAME } from "../constants/cookie.config";

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
	 * @param response - FastifyReply object (setCookie/clearCookie)
	 * @param name - Cookie name (validated against CookieNames union)
	 * @param value - Cookie value (null/undefined clears the cookie)
	 * @param options - Optional overrides for cookie options
	 *
	 * @returns A {@link CookieResult} indicating success or failure
	 */
	public static setCookie(response: FastifyReply, name: CookieNames, value: string | null | undefined, options?: Partial<ExtendedCookieOptions>): CookieResult {
		// Validate cookie name
		if (!CookieService.allowedNames.includes(name)) {
			return {
				success: false,
				error: new Error(`Invalid cookie name: "${name}". Allowed: ${CookieService.allowedNames.join(", ")}`),
			};
		}

		// Validate cookie value length (only for non-null values)
		if (value !== null && value !== undefined && Buffer.byteLength(value, "utf-8") > CookieService.maxCookieValueBytes) {
			const size = Buffer.byteLength(value, "utf-8");
			console.error(
				`[CookieService] REJECTED cookie "${name}": ${String(size)} bytes exceeds ${String(CookieService.maxCookieValueBytes)} byte limit. ` +
					"The JWT access token is too large for a browser cookie. Reduce the permissions in the token payload.",
			);
			return {
				success: false,
				error: new Error(`Cookie value for "${name}" exceeds ${String(CookieService.maxCookieValueBytes)} bytes (${String(size)} bytes given)`),
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
			response.setCookie(name, value, mergedOptions);
		}

		return { success: true };
	}
}

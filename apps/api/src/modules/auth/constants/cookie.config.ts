import type { CookieSerializeOptions } from "@fastify/cookie";
import { Injectable } from "@nestjs/common";

import { type CookieNames } from "@workspace/shared";

export type { CookieNames };

/** Name of the access token cookie */
export const ACCESS_TOKEN_COOKIE_NAME: CookieNames = "accessToken";

/** Name of the refresh token cookie */
export const REFRESH_TOKEN_COOKIE_NAME: CookieNames = "refreshToken";

/** Name of the admin access token cookie (isolated from web cookies) */
export const ADMIN_ACCESS_TOKEN_COOKIE_NAME: CookieNames = "adminAccessToken";

/** Name of the admin refresh token cookie (isolated from web cookies) */
export const ADMIN_REFRESH_TOKEN_COOKIE_NAME: CookieNames = "adminRefreshToken";

/** Extended cookie options with same-site as required (not optional) */
export interface ExtendedCookieOptions extends CookieSerializeOptions {
	readonly sameSite: boolean | "lax" | "strict" | "none";
}

// ── Injectable Service ─────────────────────────────────────────────────────

/**
 * Configuration for httpOnly JWT cookie settings.
 *
 * - Access token: short-lived, used for API authentication
 * - Refresh token: longer-lived, used to rotate access tokens
 *
 * Both are httpOnly, secure-only (in production), same-site lax,
 * and path-scoped to prevent unnecessary cookie transmission.
 */
@Injectable()
export class CookieConfigService {
	/** Cookie name for the access token */
	public readonly accessTokenName: CookieNames = ACCESS_TOKEN_COOKIE_NAME;

	/** Cookie name for the refresh token */
	public readonly refreshTokenName: CookieNames = REFRESH_TOKEN_COOKIE_NAME;

	/** Options for the access token cookie */
	public readonly accessTokenOptions: ExtendedCookieOptions = {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
	};

	/** Options for the refresh token cookie */
	public readonly refreshTokenOptions: ExtendedCookieOptions = {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
	};
}

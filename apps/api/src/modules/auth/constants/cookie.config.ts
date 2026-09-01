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

/** Name of the merchant access token cookie (isolated from consumer web) */
export const MERCHANT_ACCESS_TOKEN_COOKIE_NAME: CookieNames = "merchantAccessToken";

/** Name of the merchant refresh token cookie (isolated from consumer web) */
export const MERCHANT_REFRESH_TOKEN_COOKIE_NAME: CookieNames = "merchantRefreshToken";

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
		// In development the API (localhost:8080) and the web/admin apps
		// (localhost:3000/3001) run on different ports. Setting the cookie
		// domain to "localhost" (without port) makes the browser share the
		// cookie across all localhost ports — so the Next.js proxy can read
		// the httpOnly tokens. In production the domain is either the actual
		// host or unset (same-origin behind a reverse proxy).
		domain: process.env.COOKIE_DOMAIN ?? undefined,
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
	};

	/** Options for the refresh token cookie */
	public readonly refreshTokenOptions: ExtendedCookieOptions = {
		domain: process.env.COOKIE_DOMAIN ?? undefined,
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
	};
}

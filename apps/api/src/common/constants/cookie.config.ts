import { Injectable } from "@nestjs/common";
import type { CookieOptions } from "express";

// ── Exported Constants ─────────────────────────────────────────────────────

/** Union of all supported cookie names */
export type CookieNames = "accessToken" | "refreshToken";

/** Name of the access token cookie */
export const ACCESS_TOKEN_COOKIE_NAME: CookieNames = "accessToken";

/** Name of the refresh token cookie */
export const REFRESH_TOKEN_COOKIE_NAME: CookieNames = "refreshToken";

/** Extended cookie options with same-site as required (not optional) */
export interface ExtendedCookieOptions extends CookieOptions {
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

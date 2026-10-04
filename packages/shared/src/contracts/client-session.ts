import type { AuthClientType } from "../schemas/auth/auth";
import type { CookieNames } from "../schemas/auth/cookies";

/**
 * Header that tells the API which frontend (and therefore which isolated
 * httpOnly cookie set) a request belongs to. The API reads it in the auth
 * guard, the refresh guard and the cookie interceptors; every first-party
 * client sends it on every request.
 */
export const CLIENT_TYPE_HEADER = "X-Client-Type";

/** The httpOnly cookie pair one frontend's session lives in. */
export interface AuthCookieNamePair {
	readonly accessToken: CookieNames;
	readonly refreshToken: CookieNames;
}

/**
 * The cookie pair per frontend. One table for the API (which sets them),
 * the route proxies (which refresh them) and the SSR caller (which forwards
 * them) — a renamed cookie can no longer drift between the three.
 */
export const AUTH_COOKIE_NAMES: Readonly<Record<AuthClientType, AuthCookieNamePair>> = {
	web: { accessToken: "accessToken", refreshToken: "refreshToken" },
	admin: { accessToken: "adminAccessToken", refreshToken: "adminRefreshToken" },
	merchant: { accessToken: "merchantAccessToken", refreshToken: "merchantRefreshToken" },
};

/** The `X-Client-Type` header for a frontend — sent on every request, `web` included, so the API never guesses the cookie set. */
export function clientTypeHeader(clientType: AuthClientType): Readonly<Record<string, string>> {
	return { [CLIENT_TYPE_HEADER]: clientType };
}

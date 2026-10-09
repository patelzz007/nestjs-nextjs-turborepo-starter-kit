import type { AuthClientType, BrowserClientType } from "../schemas/auth/auth";
import type { CookieNames } from "../schemas/auth/cookies";

/**
 * Header that tells the API which app a request belongs to: for a browser
 * app, which isolated httpOnly cookie set it uses; for `mobile`, that its
 * tokens travel in JSON bodies (ADR 029). The API reads it in the auth guard,
 * the refresh guard, the cookie / token-delivery interceptors and the mobile
 * version guard; every first-party client sends it on every request.
 */
export const CLIENT_TYPE_HEADER = "X-Client-Type";

/**
 * Header the mobile app sends on every request with its own semantic version
 * (`AppVersionSchema`). The API rejects a `mobile` request whose version is
 * missing, malformed or below `MOBILE_MIN_SUPPORTED_VERSION` with 426
 * `APP_VERSION_UNSUPPORTED` (ADR 033). Browser apps never send it.
 */
export const APP_VERSION_HEADER = "X-App-Version";

/**
 * Headers the mobile app sends at sign-in and on refresh with the device's
 * model (`iPhone 15 Pro`) and its own name (`Alex’s iPhone`), from
 * `expo-device`. Values are percent-encoded UTF-8
 * (`encodeSessionDeviceHeaderValue`). The API reads them for client type
 * `mobile` only, validates them (`SessionDeviceModelHeaderSchema` /
 * `SessionDeviceNameHeaderSchema`) and stores them on the device session for
 * DISPLAY ONLY — they never influence authorization (docs/technical/mobile/mobile-app.md §8.2).
 */
export const DEVICE_MODEL_HEADER = "X-Device-Model";

/** The device's own name — see {@link DEVICE_MODEL_HEADER}. */
export const DEVICE_NAME_HEADER = "X-Device-Name";

/** The httpOnly cookie pair one frontend's session lives in. */
export interface AuthCookieNamePair {
	readonly accessToken: CookieNames;
	readonly refreshToken: CookieNames;
}

/**
 * The cookie pair per browser frontend. One table for the API (which sets
 * them), the route proxies (which refresh them) and the SSR caller (which
 * forwards them) — a renamed cookie can no longer drift between the three.
 *
 * Browser client types only: `mobile` has no cookie pair — its tokens travel
 * in JSON bodies (ADR 029), so no API code path can set or read a cookie for it.
 */
export const AUTH_COOKIE_NAMES: Readonly<Record<BrowserClientType, AuthCookieNamePair>> = {
	web: { accessToken: "accessToken", refreshToken: "refreshToken" },
	admin: { accessToken: "adminAccessToken", refreshToken: "adminRefreshToken" },
	merchant: { accessToken: "merchantAccessToken", refreshToken: "merchantRefreshToken" },
};

/** The `X-Client-Type` header for a client — sent on every request, `web` included, so the API never guesses the client type. */
export function clientTypeHeader(clientType: AuthClientType): Readonly<Record<string, string>> {
	return { [CLIENT_TYPE_HEADER]: clientType };
}

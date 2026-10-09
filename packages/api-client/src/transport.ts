// ============================================
// transport.ts - how a session travels with each request
// ============================================
// Two transports feed the same server-side session model (ADR 029):
//
// - Cookie transport (`web`, `admin`, `merchant`): the browser sends the
//   httpOnly cookies (`credentials: "include"`); the API chooses the cookie
//   pair by `X-Client-Type`. The web auth facade owns the refresh.
// - Token transport (`mobile`): the access token goes out as
//   `Authorization: Bearer`, cookies never do (`credentials: "omit"`). A 401
//   runs ONE shared body-token refresh, retries once, and a dead session clears
//   the stored tokens and reports it once.

import type { AuthClientType } from "@workspace/shared";

import { bearerAuthorizationHeader } from "./http";
import { createBodyTokenRefresh, createRefreshCooldown, createSingleFlightRefresh, type RefreshCall } from "./refresh";
import type { TokenProvider } from "./token-provider";

/** Called when the session ended for good: the refresh was refused, or the API revoked the session. */
export type OnSessionExpired = () => void | Promise<void>;

/**
 * A token-transport request that presents NO access token and bypasses the
 * 401 pipeline: the lifecycle calls (sign out, sign out everywhere) that are
 * identified by the refresh token in their body (`fetchBodyTokenLifecycleMutation`).
 */
export interface AnonymousTokenRequestTransport {
	readonly kind: "anonymous-token";
}

/** The request-level cookie transport: credentials are the browser's cookies. */
export interface CookieRequestTransport {
	readonly kind: "cookie";
}

/** The request-level token transport, built once per client by {@link createTokenRequestTransport}. */
export interface TokenRequestTransport {
	readonly kind: "token";
	readonly tokenProvider: TokenProvider;
	/** The single-flight body-token refresh every request of this client shares. */
	readonly refresh: RefreshCall;
	/**
	 * Ends the session once: clears the stored tokens, then calls
	 * `onSessionExpired`. A request sent without an access token, or whose
	 * access token is no longer the stored one (the session already ended, or a
	 * new one started), changes nothing.
	 */
	readonly endSession: (sentAccessToken: string | null) => Promise<void>;
}

export type RequestTransport = CookieRequestTransport | TokenRequestTransport | AnonymousTokenRequestTransport;

/** See {@link AnonymousTokenRequestTransport}. */
export const ANONYMOUS_TOKEN_REQUEST_TRANSPORT: AnonymousTokenRequestTransport = { kind: "anonymous-token" };

/** The browser transport — what every context without an explicit transport uses. */
export const COOKIE_REQUEST_TRANSPORT: CookieRequestTransport = { kind: "cookie" };

/** The credentials and auth headers of ONE attempt of a request. */
export interface AttemptAuthorization {
	readonly credentials: RequestCredentials;
	readonly headers: Readonly<Record<string, string>>;
}

/** Every cookie-transport attempt: the browser attaches the session cookies. */
export const COOKIE_ATTEMPT_AUTHORIZATION: AttemptAuthorization = { credentials: "include", headers: {} };

/** A token-transport attempt: the bearer header when an access token is held, never cookies. */
export function tokenAttemptAuthorization(accessToken: string | null): AttemptAuthorization {
	return { credentials: "omit", headers: bearerAuthorizationHeader(accessToken) };
}

/** What {@link createTokenRequestTransport} needs. */
export interface TokenRequestTransportOptions {
	readonly baseUrl: string;
	readonly clientType: AuthClientType;
	readonly appVersion?: string | undefined;
	/** Static headers of the client, sent with the refresh too. */
	readonly headers?: Readonly<Record<string, string>> | undefined;
	readonly tokenProvider: TokenProvider;
	readonly onSessionExpired?: OnSessionExpired | undefined;
}

/**
 * Builds the token transport of one client: a body-token refresh behind the
 * shared transient-failure cooldown and a single flight, plus a session end
 * that runs at most once per session however many requests see it die.
 */
export function createTokenRequestTransport(options: TokenRequestTransportOptions): TokenRequestTransport {
	const { tokenProvider, onSessionExpired } = options;
	const refresh: RefreshCall = createSingleFlightRefresh(
		createRefreshCooldown(
			createBodyTokenRefresh({ baseUrl: options.baseUrl, clientType: options.clientType, appVersion: options.appVersion, headers: options.headers, tokenProvider }),
		),
	);
	let ending: Promise<void> | null = null;

	const endSession = async (sentAccessToken: string | null): Promise<void> => {
		// A request that carried no access token has no session to end, and one
		// whose token is no longer stored lost a race with an earlier end (or a new sign-in).
		if (sentAccessToken === null || (await tokenProvider.getAccessToken()) !== sentAccessToken) {
			return;
		}
		ending ??= (async (): Promise<void> => {
			try {
				await tokenProvider.clearTokens();
				await onSessionExpired?.();
			} finally {
				ending = null;
			}
		})();
		await ending;
	};

	return { kind: "token", tokenProvider, refresh, endSession };
}
